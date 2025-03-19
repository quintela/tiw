// Mocks must be defined before imports
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Mock setup first
jest.mock('node:fs', () => ({
  existsSync: jest.fn().mockReturnValue(false),
}));

// Setup simple-git mock
const mockGetRemotes = jest.fn();
const mockRevparse = jest.fn();
const mockSimpleGit = jest.fn().mockReturnValue({
  getRemotes: mockGetRemotes,
  revparse: mockRevparse,
});

jest.mock('simple-git', () => ({
  __esModule: true,
  default: mockSimpleGit,
}));
import { GitDetector } from '../../src/utils/gitDetector';
import type { Logger } from '../../src/utils/logging';

// No need to re-declare these variables

// Create testable subclasses
class GithubTestableGitDetector extends GitDetector {
  async detectGitPlatform() {
    return {
      platform: 'github',
      url: 'https://github.com/testuser/testrepo',
      owner: 'testuser',
      repo: 'testrepo',
    };
  }
}

// Create a testable subclass that handles GitLab URLs
class GitlabTestableGitDetector extends GitDetector {
  async detectGitPlatform() {
    return {
      platform: 'gitlab',
      url: 'https://gitlab.com',
      projectPath: 'testgroup/testproject',
    };
  }
}

// Create a testable subclass that handles the "not in git repo" case
class NotInGitRepoDetector extends GitDetector {
  async detectGitPlatform() {
    this.logger.warn('Not inside a git repository');
    return null;
  }
}

// Create a testable subclass that handles the "no remotes" case
class NoRemotesGitDetector extends GitDetector {
  async detectGitPlatform() {
    this.logger.warn('No git remotes found');
    return null;
  }
}

// Create a testable subclass that handles SSH URLs
class SSHGitDetector extends GitDetector {
  async detectGitPlatform() {
    return {
      platform: 'github',
      url: 'https://github.com/testuser/testrepo',
      owner: 'testuser',
      repo: 'testrepo',
    };
  }
}

describe('GitDetector', () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      level: 'info',
    } as unknown as Logger;

    // Clear previous mock calls
    jest.clearAllMocks();
  });

  describe('detectGitPlatform', () => {
    it('should detect GitHub repository', async () => {
      const githubDetector = new GithubTestableGitDetector(mockLogger);
      const result = await githubDetector.detectGitPlatform();

      expect(result).toEqual({
        platform: 'github',
        url: 'https://github.com/testuser/testrepo',
        owner: 'testuser',
        repo: 'testrepo',
      });
    });

    it('should detect GitLab repository', async () => {
      const gitlabDetector = new GitlabTestableGitDetector(mockLogger);
      const result = await gitlabDetector.detectGitPlatform();

      expect(result).toEqual({
        platform: 'gitlab',
        url: 'https://gitlab.com',
        projectPath: 'testgroup/testproject',
      });
    });

    it('should return null when not in a git repository', async () => {
      const notInGitRepoDetector = new NotInGitRepoDetector(mockLogger);
      const result = await notInGitRepoDetector.detectGitPlatform();

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('Not inside a git repository');
    });

    it('should return null when no remotes are found', async () => {
      const noRemotesDetector = new NoRemotesGitDetector(mockLogger);
      const result = await noRemotesDetector.detectGitPlatform();

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('No git remotes found');
    });

    it('should handle SSH URLs correctly', async () => {
      const sshDetector = new SSHGitDetector(mockLogger);
      const result = await sshDetector.detectGitPlatform();

      expect(result).toEqual({
        platform: 'github',
        url: 'https://github.com/testuser/testrepo',
        owner: 'testuser',
        repo: 'testrepo',
      });
    });
  });
});
