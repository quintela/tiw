import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { LLMAdapter } from '@/adapters/llm/LLMAdapter';
import type { AppConfig } from '@/config/config';
import { Logger } from '@/utils/logging';

// Mock Logger
jest.mock('@/utils/logging', () => {
  return {
    Logger: jest.fn().mockImplementation(() => {
      return {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        user: jest.fn(),
        setLevel: jest.fn(),
      };
    }),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});

// Create a concrete implementation of the abstract class for testing
class TestLLMAdapter extends LLMAdapter {
  initClient(): unknown {
    return {};
  }

  async sendRequest(_prompt: string): Promise<string> {
    return 'analysis result';
  }
}

describe('LLMAdapter', () => {
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
    verbose: false,
    maxPromptTokens: 100000,
    anthropicMaxTokens: 190000,
    openaiMaxTokens: 128000,
    deepseekMaxTokens: 128000,
    copilotMaxTokens: 128000,
  } as AppConfig;

  it('should not allow direct instantiation', () => {
    expect(() => {
      // @ts-expect-error Testing constructor error
      new LLMAdapter(mockConfig);
    }).toThrow('LLMAdapter is an abstract class and cannot be instantiated directly');
  });

  it('should allow extension', () => {
    expect(() => {
      new TestLLMAdapter(mockConfig);
    }).not.toThrow();
  });

  describe('processResponse', () => {
    it('should extract and process JSON from markdown code blocks', () => {
      const adapter = new TestLLMAdapter(mockConfig);
      const response = '```json\n{"result": "success", "score": 100}\n```';

      const result = adapter.processResponse(response);

      expect(result).toBe('{"result":"success","score":100}');
    });

    it('should handle code blocks without json tag', () => {
      const adapter = new TestLLMAdapter(mockConfig);
      const response = '```\n{"result": "success", "score": 100}\n```';

      const result = adapter.processResponse(response);

      expect(result).toBe('{"result":"success","score":100}');
    });

    it('should handle invalid JSON in code blocks', () => {
      const adapter = new TestLLMAdapter(mockConfig);
      const response = '```json\n{"result": "success", score: 100}\n```';

      const result = adapter.processResponse(response);

      expect(result).toBe(response);
      expect((adapter as any).logger.warn).toHaveBeenCalled();
    });

    it('should process raw JSON responses', () => {
      const adapter = new TestLLMAdapter(mockConfig);
      const response = '{"result": "success", "score": 100}';

      const result = adapter.processResponse(response);

      expect(result).toBe('{"result":"success","score":100}');
    });

    it('should return plain text for non-JSON responses', () => {
      const adapter = new TestLLMAdapter(mockConfig);
      const response = 'This is a plain text response.';

      const result = adapter.processResponse(response);

      expect(result).toBe(response);
      expect((adapter as any).logger.warn).toHaveBeenCalled();
    });
  });
});
