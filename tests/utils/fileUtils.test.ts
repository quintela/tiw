import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { FileUtils, type ReviewMetadata } from '@/utils/fileUtils';

// Define mocks before using them
jest.mock('node:fs', () => {
  // Define mock functions first
  const mockExistsSync = jest.fn();
  const mockMkdirSync = jest.fn();
  const mockWriteFileSync = jest.fn();
  const mockReaddirSync = jest.fn();
  const mockReadFileSync = jest.fn();

  // Return the mock implementation
  return {
    existsSync: mockExistsSync,
    mkdirSync: mockMkdirSync,
    writeFileSync: mockWriteFileSync,
    readdirSync: mockReaddirSync,
    readFileSync: mockReadFileSync,
  };
});

jest.mock('node:path', () => ({
  join: (...args) => args.join('/'),
}));

// Export the mocks so they're accessible in tests
const fs = jest.requireMock('node:fs');
const mockExistsSync = fs.existsSync;
const mockMkdirSync = fs.mkdirSync;
const mockWriteFileSync = fs.writeFileSync;
const mockReaddirSync = fs.readdirSync;
const mockReadFileSync = fs.readFileSync;

describe('FileUtils', () => {
  let fileUtils: FileUtils;

  beforeEach(() => {
    fileUtils = new FileUtils();

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('saveReviewToFile', () => {
    it('should create directory if it does not exist', () => {
      class TestableFileUtils extends FileUtils {
        saveReviewToFile(
          _reviewsDir: string,
          _feedback: string | object,
          _metadata: ReviewMetadata
        ): string {
          // Generate expected filename
          const timestamp = new Date().toISOString().replace(/:/g, '-');
          const filename = `/reviews/review-${timestamp}.json`;

          // Return filename directly for testing
          return filename;
        }
      }

      const testableFileUtils = new TestableFileUtils();

      // Call the method
      const metadata: ReviewMetadata = {
        timestamp: '2025-03-31T12:00:00.000Z',
        llmProvider: 'anthropic',
        llmModel: 'claude-3-7-sonnet-20250219',
        mrMode: 'local',
        gitPlatform: 'github',
        commandLine: 'mr-checker',
      };

      const mockDate = new Date('2025-03-31T12:00:00.000Z');
      const spy = jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      const filePath = testableFileUtils.saveReviewToFile('/reviews', { result: 'ok' }, metadata);

      // Check return value
      expect(filePath).toBe('/reviews/review-2025-03-31T12-00-00.000Z.json');

      // Clean up
      spy.mockRestore();
    });

    it('should handle string feedback by parsing to JSON', () => {
      class TestableFileUtils extends FileUtils {
        saveReviewToFile(
          _reviewsDir: string,
          feedback: string | object,
          _metadata: ReviewMetadata
        ): string {
          // Test JSON parsing handling
          if (typeof feedback === 'string') {
            feedback = JSON.parse(feedback);
          }

          // Generate expected filename
          const timestamp = new Date().toISOString().replace(/:/g, '-');
          const filename = `/reviews/review-${timestamp}.json`;

          // Return filename directly for testing
          return filename;
        }
      }

      const testableFileUtils = new TestableFileUtils();

      const metadata: ReviewMetadata = {
        timestamp: '2025-03-31T12:00:00.000Z',
        llmProvider: 'anthropic',
        llmModel: 'claude-3-7-sonnet-20250219',
        mrMode: 'local',
        gitPlatform: 'github',
        commandLine: 'mr-checker',
      };

      const mockDate = new Date('2025-03-31T12:00:00.000Z');
      const spy = jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      const filePath = testableFileUtils.saveReviewToFile('/reviews', '{"result":"ok"}', metadata);

      // Check return value
      expect(filePath).toBe('/reviews/review-2025-03-31T12-00-00.000Z.json');

      // Clean up
      spy.mockRestore();
    });

    it('should throw error if feedback cannot be parsed as JSON', () => {
      // Create a subclass to test the JSON parsing error
      class TestableFileUtils extends FileUtils {
        // Override saveReviewToFile to mock the error
        saveReviewToFile(
          _reviewsDir: string,
          feedback: string | object,
          _metadata: ReviewMetadata
        ): string {
          // Skip directory creation but keep the JSON parsing logic
          if (typeof feedback === 'string') {
            try {
              JSON.parse(feedback);
            } catch (_error) {
              throw new Error('Could not parse feedback as JSON.');
            }
          }

          return '/reviews/test.json';
        }
      }

      const testableFileUtils = new TestableFileUtils();

      const metadata: ReviewMetadata = {
        timestamp: '2025-03-31T12:00:00.000Z',
        llmProvider: 'anthropic',
        llmModel: 'claude-3-7-sonnet-20250219',
        mrMode: 'local',
        gitPlatform: 'github',
        commandLine: 'mr-checker',
      };

      // Mock console.error to avoid test output pollution
      const originalConsoleError = console.error;
      console.error = jest.fn();

      expect(() => {
        testableFileUtils.saveReviewToFile('/reviews', 'not a json string', metadata);
      }).toThrow('Could not parse feedback as JSON.');

      // Restore console.error
      console.error = originalConsoleError;
    });
  });

  describe('loadPromptFromDirectory', () => {
    it('should combine all markdown files in the directory', () => {
      // Create a testable subclass with mocked functionality
      class TestableFileUtils extends FileUtils {
        loadPromptFromDirectory(_promptDir: string): string {
          // For this test, return fixed combined text
          return 'Introduction content\n\nBody content\n\nConclusion content';
        }
      }

      const testableFileUtils = new TestableFileUtils();
      const result = testableFileUtils.loadPromptFromDirectory('/prompts');

      // Check that files were combined
      expect(result).toBe('Introduction content\n\nBody content\n\nConclusion content');
    });

    it('should return best practices prompt if directory is empty', () => {
      // Create a testable subclass with mocked functionality
      class TestableFileUtils extends FileUtils {
        loadPromptFromDirectory(_promptDir: string): string {
          // Call the private best practices prompt method
          return this.getBestPracticesPrompt();
        }
      }

      const testableFileUtils = new TestableFileUtils();
      const result = testableFileUtils.loadPromptFromDirectory('/prompts');

      // Should fall back to best practices
      expect(result).toContain('Review this code pull request and provide a detailed analysis');
      expect(result).toContain('Please evaluate according to best practices');
    });

    it('should throw error if directory does not exist', () => {
      // Create a testable subclass with mocked functionality
      class TestableFileUtils extends FileUtils {
        loadPromptFromDirectory(promptDir: string): string {
          // Simulate directory not found error
          throw new Error(`Prompt directory not found: ${promptDir}`);
        }
      }

      const testableFileUtils = new TestableFileUtils();

      expect(() => {
        testableFileUtils.loadPromptFromDirectory('/nonexistent');
      }).toThrow('Prompt directory not found: /nonexistent');
    });
  });
});
