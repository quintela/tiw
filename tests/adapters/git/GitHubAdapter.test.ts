// Mocks must be defined before imports
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

// Mock setup first
const mockGet = jest.fn().mockResolvedValue({ data: 'default response' });
const mockPost = jest.fn().mockResolvedValue({});
const mockIsAxiosError = jest.fn().mockReturnValue(false);

jest.mock('axios', () => ({
  get: mockGet,
  post: mockPost,
  isAxiosError: mockIsAxiosError,
  create: jest.fn().mockReturnValue({
    get: mockGet,
    post: mockPost,
  }),
}));
import type { AppConfig } from '@/config/config';
import { GitHubAdapter, type GitHubPRParams } from '@/adapters/git/GitHubAdapter';

describe('GitHubAdapter', () => {
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
    githubToken: 'test-github-token',
    projectId: undefined,
    mergeRequestIid: undefined,
    mrMode: 'local',
    gitMrUrl: null,
    showDiff: false,
    reviewsDir: '/reviews',
    promptDir: '/prompts',
    formatterTemplate: '/formatters/template.md',
  } as AppConfig;

  describe('parseRequestUrl', () => {
    describe('when given invalid input', () => {
      it('should throw for invalid URL format', () => {
        const adapter = new GitHubAdapter(mockConfig);
        const invalidUrl = 'https://github.com/owner/repo/invalid/123';

        expect(() => {
          adapter.parseRequestUrl(invalidUrl);
        }).toThrow('Invalid GitHub PR URL');
      });

      it('should log error message to console', () => {
        const adapter = new GitHubAdapter(mockConfig);
        const invalidUrl = 'https://github.com/owner/repo/invalid/123';

        try {
          adapter.parseRequestUrl(invalidUrl);
        } catch (_error) {
          // Ignore error
        }

        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining('Error parsing GitHub PR URL'),
          expect.any(String)
        );
      });

      it('should throw for malformed URL', () => {
        const adapter = new GitHubAdapter(mockConfig);
        const malformedUrl = 'not-a-url';

        expect(() => {
          adapter.parseRequestUrl(malformedUrl);
        }).toThrow('Invalid GitHub PR URL');
      });
    });

    describe('when given valid GitHub PR URL', () => {
      it('should extract owner from URL', () => {
        const adapter = new GitHubAdapter(mockConfig);
        const url = 'https://github.com/owner/repo/pull/123';

        const result = adapter.parseRequestUrl(url);

        expect(result.owner).toBe('owner');
      });

      it('should extract repo from URL', () => {
        const adapter = new GitHubAdapter(mockConfig);
        const url = 'https://github.com/owner/repo/pull/123';

        const result = adapter.parseRequestUrl(url);

        expect(result.repo).toBe('repo');
      });

      it('should extract pull number from URL', () => {
        const adapter = new GitHubAdapter(mockConfig);
        const url = 'https://github.com/owner/repo/pull/123';

        const result = adapter.parseRequestUrl(url);

        expect(result.pullNumber).toBe('123');
      });
    });
  });

  describe('getRequestDiff', () => {
    const params: GitHubPRParams = {
      owner: 'owner',
      repo: 'repo',
      pullNumber: '123',
    };

    describe('when API request fails', () => {
      it('should throw when API request fails', async () => {
        // Reset and mock only for this specific test
        jest.clearAllMocks();

        const adapter = new GitHubAdapter(mockConfig);
        const testError = new Error('API error');

        // Set up test-specific mocks
        mockGet.mockRejectedValue(testError);

        await expect(adapter.getRequestDiff(params as Record<string, string>)).rejects.toThrow();
      });

      it('should log error message to console', async () => {
        // Reset and mock only for this specific test
        jest.clearAllMocks();

        const adapter = new GitHubAdapter(mockConfig);
        const testError = new Error('API error');

        // Set up test-specific mocks
        mockGet.mockRejectedValue(testError);

        try {
          await adapter.getRequestDiff(params as Record<string, string>);
        } catch (_error) {
          // Expected to throw, ignore
        }

        expect(console.error).toHaveBeenCalledWith(
          'Error fetching PR diff from GitHub:',
          expect.any(String)
        );
      });

      it('should log additional details for Axios errors', async () => {
        // Reset and set up specifically for this test
        jest.clearAllMocks();

        const adapter = new GitHubAdapter(mockConfig);
        const axiosError = {
          message: 'API error',
          response: {
            status: 404,
            data: { message: 'Not found' },
          },
        };

        // Mock both the request rejection and the isAxiosError check
        mockGet.mockRejectedValue(axiosError);
        mockIsAxiosError.mockReturnValue(true);

        try {
          await adapter.getRequestDiff(params as Record<string, string>);
        } catch (_error) {
          // Expected to throw, we're just testing the logging
        }

        // Check all expected logging happened
        expect(console.error).toHaveBeenCalledWith(
          'Error fetching PR diff from GitHub:',
          expect.any(String)
        );

        expect(console.error).toHaveBeenCalledWith('Response status:', 404);
      });
    });

    describe('when API request succeeds', () => {
      beforeEach(() => {
        // Reset the mock and provide a successful response for all tests in this block
        mockGet.mockReset();
        mockGet.mockResolvedValue({ data: 'diff content' }); // Each test will override if needed
      });

      it('should call the GitHub API with correct URL', async () => {
        const adapter = new GitHubAdapter(mockConfig);

        await adapter.getRequestDiff(params as Record<string, string>);

        expect(mockGet).toHaveBeenCalledWith(
          'https://api.github.com/repos/owner/repo/pulls/123',
          expect.any(Object)
        );
      });

      it('should include authorization header with token', async () => {
        const adapter = new GitHubAdapter(mockConfig);

        await adapter.getRequestDiff(params as Record<string, string>);

        expect(mockGet).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-github-token',
            }),
          })
        );
      });

      it('should request diff format via Accept header', async () => {
        const adapter = new GitHubAdapter(mockConfig);

        await adapter.getRequestDiff(params as Record<string, string>);

        expect(mockGet).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              Accept: 'application/vnd.github.v3.diff',
            }),
          })
        );
      });

      it('should return the diff content from response data', async () => {
        const adapter = new GitHubAdapter(mockConfig);
        const expectedDiff = 'diff content';
        mockGet.mockResolvedValueOnce({ data: expectedDiff });

        const result = await adapter.getRequestDiff(params as Record<string, string>);

        expect(result).toBe(expectedDiff);
      });

      it('should log fetch operation to console', async () => {
        const adapter = new GitHubAdapter(mockConfig);

        await adapter.getRequestDiff(params as Record<string, string>);

        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Fetching PR diff from'));
      });
    });
  });

  describe('commentOnRequest', () => {
    const params: GitHubPRParams = {
      owner: 'owner',
      repo: 'repo',
      pullNumber: '123',
    };

    describe('when API request fails', () => {
      it('should throw when API request fails', async () => {
        // Reset and mock only for this specific test
        jest.clearAllMocks();

        const adapter = new GitHubAdapter(mockConfig);
        const testError = new Error('API error');

        // Set up test-specific mocks
        mockPost.mockRejectedValue(testError);

        await expect(
          adapter.commentOnRequest(params as Record<string, string>, 'comment')
        ).rejects.toThrow();
      });

      it('should log error message to console', async () => {
        // Reset and mock only for this specific test
        jest.clearAllMocks();

        const adapter = new GitHubAdapter(mockConfig);
        const testError = new Error('API error');

        // Set up test-specific mocks
        mockPost.mockRejectedValue(testError);

        try {
          await adapter.commentOnRequest(params as Record<string, string>, 'comment');
        } catch (_error) {
          // Expected to throw, ignore
        }

        expect(console.error).toHaveBeenCalledWith(
          'Error posting comment on PR:',
          expect.any(String)
        );
      });

      it('should log additional details for Axios errors', async () => {
        // Reset and set up specifically for this test
        jest.clearAllMocks();

        const adapter = new GitHubAdapter(mockConfig);
        const axiosError = {
          message: 'API error',
          response: {
            status: 403,
            data: { message: 'Forbidden' },
          },
        };

        // Mock both the request rejection and the isAxiosError check
        mockPost.mockRejectedValue(axiosError);
        mockIsAxiosError.mockReturnValue(true);

        try {
          await adapter.commentOnRequest(params as Record<string, string>, 'comment');
        } catch (_error) {
          // Expected to throw, we're just testing the logging
        }

        // Check all expected logging happened
        expect(console.error).toHaveBeenCalledWith('Error posting comment on PR:', 'API error');

        expect(console.error).toHaveBeenCalledWith('Response status:', 403);
      });
    });

    describe('when API request succeeds', () => {
      beforeEach(() => {
        // Reset the mock and provide a successful response for all tests in this block
        mockPost.mockReset();
        mockPost.mockResolvedValue({}); // Each test will override this if needed
      });

      it('should call the GitHub API with correct URL', async () => {
        const adapter = new GitHubAdapter(mockConfig);

        await adapter.commentOnRequest(params as Record<string, string>, 'comment');

        expect(mockPost).toHaveBeenCalledWith(
          'https://api.github.com/repos/owner/repo/issues/123/comments',
          expect.any(Object),
          expect.any(Object)
        );
      });

      it('should include authorization header with token', async () => {
        const adapter = new GitHubAdapter(mockConfig);

        await adapter.commentOnRequest(params as Record<string, string>, 'comment');

        expect(mockPost).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Object),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-github-token',
            }),
          })
        );
      });

      it('should format comment with LLM Code Review header', async () => {
        const adapter = new GitHubAdapter(mockConfig);
        const comment = 'Test comment';

        await adapter.commentOnRequest(params as Record<string, string>, comment);

        expect(mockPost).toHaveBeenCalledWith(
          expect.any(String),
          { body: `## LLM Code Review Feedback\n\n${comment}` },
          expect.any(Object)
        );
      });

      it('should log success message to console', async () => {
        const adapter = new GitHubAdapter(mockConfig);

        await adapter.commentOnRequest(params as Record<string, string>, 'comment');

        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Successfully posted LLM feedback')
        );
      });
    });
  });
});
