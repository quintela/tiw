import fs from 'node:fs';
import path from 'node:path';

import simpleGit from 'simple-git';
import type { SimpleGit } from 'simple-git';

import type { GitPlatform } from '../config/config';
import { Logger } from './logging';

/**
 * Git platform detection result
 */
interface GitPlatformInfo {
  platform: GitPlatform;
  url: string;
  projectPath?: string;
  owner?: string;
  repo?: string;
}

/**
 * Remote repository information
 */
interface GitRemote {
  name: string;
  refs: {
    fetch: string;
    push: string;
  };
}

/**
 * Git repository detection utility
 * Detects whether a repository is GitLab or GitHub
 */
export class GitDetector {
  private git: SimpleGit;
  private logger: Logger;

  /**
   * Singleton instance of GitDetector
   */
  private static instance: GitDetector;

  /**
   * Get singleton instance of GitDetector
   * @param logger - Optional logger instance
   * @returns The GitDetector instance
   */
  public static getInstance(logger?: Logger): GitDetector {
    if (!GitDetector.instance) {
      GitDetector.instance = new GitDetector(logger);
    }
    return GitDetector.instance;
  }

  /**
   * Create a new GitDetector
   */
  constructor(logger?: Logger) {
    this.git = simpleGit({});
    this.logger = logger || new Logger();
  }

  /**
   * Auto-detect git remote details from the current working directory
   * @returns Detected git platform information or null if not detected
   */
  async detectGitPlatform(): Promise<GitPlatformInfo | null> {
    try {
      if (!(await this.isGitRepo())) {
        this.logger.warn('Not inside a git repository');
        return null;
      }

      const remote = await this.findPrimaryRemote();
      if (!remote) {
        return null;
      }

      return this.determineGitPlatform(remote.refs.fetch);
    } catch (error) {
      this.logError('Error detecting git platform', error);
      return null;
    }
  }

  /**
   * Check if the current directory is a git repository
   * @returns True if we're in a git repository
   */
  private async isGitRepo(): Promise<boolean> {
    try {
      await this.git.revparse(['--is-inside-work-tree']);
      return true;
    } catch (_error) {
      this.logError('Error', _error);
      return false;
    }
  }

  /**
   * Find the primary remote (origin or first available)
   * @returns The primary remote or null if none found
   */
  private async findPrimaryRemote(): Promise<GitRemote | null> {
    try {
      const remotes = await this.git.getRemotes(true);

      if (!remotes.length) {
        this.logger.warn('No git remotes found');
        return null;
      }

      // Prefer origin over others
      const origin = remotes.find((r: GitRemote) => r.name === 'origin') || remotes[0];

      if (!origin || !origin.refs || !origin.refs.fetch) {
        this.logger.warn('No valid git remote origin found');
        return null;
      }

      return origin;
    } catch (error) {
      this.logError('Error finding primary remote', error);
      return null;
    }
  }

  /**
   * Determine which git platform a URL belongs to
   * @param remoteUrl - The remote URL to analyze
   * @returns Information about the detected platform or null if not determined
   */
  private determineGitPlatform(remoteUrl: string): GitPlatformInfo | null {
    if (!remoteUrl) {
      this.logger.warn('No valid remote URL found');
      return null;
    }

    if (this.isGitHubUrl(remoteUrl)) {
      return this.extractGitHubInfo(remoteUrl);
    }

    if (this.isGitLabUrl(remoteUrl) || this.hasGitLabSpecificFiles()) {
      return this.extractGitLabInfo(remoteUrl);
    }

    this.logger.warn('Unable to determine git platform from remote URL');
    return null;
  }

  /**
   * Check if a URL is a GitHub URL
   * @param url - The URL to check
   * @returns True if the URL is a GitHub URL
   */
  private isGitHubUrl(url: string): boolean {
    return url.includes('github.com');
  }

  /**
   * Check if a URL is a GitLab URL
   * @param url - The URL to check
   * @returns True if the URL is a GitLab URL
   */
  private isGitLabUrl(url: string): boolean {
    return url.includes('gitlab.com') || url.includes('gitlab');
  }

  /**
   * Check if the repository has GitLab-specific files
   * @returns True if the repository appears to be a GitLab repository
   */
  private hasGitLabSpecificFiles(): boolean {
    return fs.existsSync(path.join(process.cwd(), '.gitlab-ci.yml'));
  }

  /**
   * Extract GitHub information from a URL
   * @param url - The GitHub remote URL
   * @returns GitHub platform information or null if parsing fails
   */
  private extractGitHubInfo(url: string): GitPlatformInfo | null {
    try {
      const { owner, repo } = this.parseGitHubUrl(url);
      return {
        platform: 'github',
        url: `https://github.com/${owner}/${repo}`,
        owner,
        repo,
      };
    } catch (error) {
      this.logError('Error extracting GitHub info', error);
      return null;
    }
  }

  /**
   * Extract GitLab information from a URL
   * @param url - The GitLab remote URL
   * @returns GitLab platform information or null if parsing fails
   */
  private extractGitLabInfo(url: string): GitPlatformInfo | null {
    try {
      const { url: gitlabUrl, projectPath } = this.parseGitLabUrl(url);
      return {
        platform: 'gitlab',
        url: gitlabUrl,
        projectPath,
      };
    } catch (error) {
      this.logError('Error extracting GitLab info', error);
      return null;
    }
  }

  /**
   * Parse a GitHub URL to extract owner and repo
   * @param url - The GitHub remote URL
   * @returns The owner and repo
   * @throws Error if the URL cannot be parsed
   */
  private parseGitHubUrl(url: string): { owner: string; repo: string } {
    // Handle SSH URLs: git@github.com:owner/repo.git
    if (url.startsWith('git@github.com:')) {
      const match = this.extractSshGitHubComponents(url);
      if (match) {
        return match;
      }
    }

    // Handle HTTPS URLs: https://github.com/owner/repo.git
    if (url.includes('github.com')) {
      const match = this.extractHttpsGitHubComponents(url);
      if (match) {
        return match;
      }
    }

    throw new Error(`Unable to parse GitHub URL: ${url}`);
  }

  /**
   * Extract owner and repo from SSH GitHub URL
   * @param url - SSH GitHub URL
   * @returns Owner and repo or null if not matched
   */
  private extractSshGitHubComponents(url: string): { owner: string; repo: string } | null {
    const match = url.match(/git@github\.com:([^/]+)\/([^.]+)(.git)?$/);
    if (match && match[1] && match[2]) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ''),
      };
    }
    return null;
  }

  /**
   * Extract owner and repo from HTTPS GitHub URL
   * @param url - HTTPS GitHub URL
   * @returns Owner and repo or null if not matched
   */
  private extractHttpsGitHubComponents(url: string): { owner: string; repo: string } | null {
    const match = url.match(/github\.com\/([^/]+)\/([^.]+)(.git)?$/);
    if (match && match[1] && match[2]) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ''),
      };
    }
    return null;
  }

  /**
   * Parse a GitLab URL to extract the project path
   * @param url - The GitLab remote URL
   * @returns The GitLab URL and project path
   * @throws Error if the URL cannot be parsed
   */
  private parseGitLabUrl(url: string): { url: string; projectPath: string } {
    // Handle SSH URLs: git@gitlab.com:group/project.git
    if (url.startsWith('git@')) {
      const sshResult = this.extractSshGitLabComponents(url);
      if (sshResult) {
        return sshResult;
      }
    }
    // Handle HTTPS URLs: https://gitlab.com/group/project.git
    else if (url.startsWith('http')) {
      const httpsResult = this.extractHttpsGitLabComponents(url);
      if (httpsResult) {
        return httpsResult;
      }
    }

    throw new Error(`Unable to extract project path from GitLab URL: ${url}`);
  }

  /**
   * Extract GitLab components from SSH URL
   * @param url - SSH GitLab URL
   * @returns GitLab URL and project path or null if not matched
   */
  private extractSshGitLabComponents(url: string): { url: string; projectPath: string } | null {
    const match = url.match(/git@([^:]+):(.+?)(.git)?$/);
    if (match && match[1] && match[2]) {
      return {
        url: `https://${match[1]}`,
        projectPath: match[2].replace(/\.git$/, ''),
      };
    }
    return null;
  }

  /**
   * Extract GitLab components from HTTPS URL
   * @param url - HTTPS GitLab URL
   * @returns GitLab URL and project path or null if not matched
   */
  private extractHttpsGitLabComponents(url: string): { url: string; projectPath: string } | null {
    try {
      const parsedUrl = new URL(url);
      const gitlabUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

      // Remove .git suffix if present
      const pathWithoutGit = parsedUrl.pathname.replace(/\.git$/, '');
      const projectPath = pathWithoutGit.startsWith('/') ? pathWithoutGit.slice(1) : pathWithoutGit;

      if (projectPath) {
        return { url: gitlabUrl, projectPath };
      }
    } catch (error) {
      this.logError('Error parsing GitLab HTTPS URL', error);
    }

    return null;
  }

  /**
   * Detect Git platform directly from URL (static method for URL mode)
   * @param url - The MR/PR URL to analyze
   * @returns Detected platform or null if not recognized
   */
  static detectPlatform(url: string): GitPlatform | null {
    if (!url) {
      return null;
    }

    // Check for GitLab URLs
    if (url.includes('gitlab.com') || url.includes('gitlab') || url.includes('/-/merge_requests/')) {
      return 'gitlab';
    }

    // Check for GitHub URLs
    if (url.includes('github.com') && url.includes('/pull/')) {
      return 'github';
    }

    return null;
  }

  /**
   * Log error with consistent formatting
   * @param message - Error message
   * @param error - Error object
   */
  private logError(message: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.logger.error(`${message}: ${errorMessage}`);
  }
}
