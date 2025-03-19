import fs from 'node:fs';
import path from 'node:path';

import simpleGit from 'simple-git';

import type { GitPlatform } from '../config/config';
import { Logger } from './logging';

/**
 * Git repository detection utility
 * Detects whether a repository is GitLab or GitHub
 */
export class GitDetector {
  private git = simpleGit({});
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
    this.logger = logger || new Logger();
  }

  /**
   * Auto-detect git remote details from the current working directory
   * @returns Detected git platform information or null if not detected
   */
  async detectGitPlatform(): Promise<{
    platform: GitPlatform;
    url: string;
    projectPath?: string;
    owner?: string;
    repo?: string;
  } | null> {
    try {
      // Check if we're in a git repository
      if (!(await this.isGitRepo())) {
        this.logger.warn('Not inside a git repository');
        return null;
      }

      // Get remotes
      const remotes = await this.git.getRemotes(true);
      if (!remotes.length) {
        this.logger.warn('No git remotes found');
        return null;
      }

      // Prefer origin over others
      const origin = remotes.find((r: any) => r.name === 'origin') || remotes[0];
      if (!origin || !origin.refs) {
        this.logger.warn('No valid git remote origin found');
        return null;
      }
      const remoteUrl = origin.refs.fetch;

      if (!remoteUrl) {
        this.logger.warn('No valid remote URL found');
        return null;
      }

      // Check if it's a GitHub URL
      if (remoteUrl.includes('github.com')) {
        const { owner, repo } = this.parseGitHubUrl(remoteUrl);
        return {
          platform: 'github',
          url: `https://github.com/${owner}/${repo}`,
          owner,
          repo,
        };
      }

      // Check if it's a GitLab URL
      if (remoteUrl.includes('gitlab.com') || remoteUrl.includes('gitlab') || this.isGitLabRepo()) {
        const { url, projectPath } = this.parseGitLabUrl(remoteUrl);
        return {
          platform: 'gitlab',
          url,
          projectPath,
        };
      }

      this.logger.warn('Unable to determine git platform from remote URL');
      return null;
    } catch (error) {
      this.logger.error('Error detecting git platform', error as Error);
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
    } catch (/* eslint-disable-line @typescript-eslint/no-unused-vars, no-unused-vars */ _error) {
      return false;
    }
  }

  /**
   * Check if the repository is a GitLab repository by looking for GitLab-specific files
   * @returns True if the repository appears to be a GitLab repository
   */
  private isGitLabRepo(): boolean {
    // Look for GitLab-specific files
    return fs.existsSync(path.join(process.cwd(), '.gitlab-ci.yml'));
  }

  /**
   * Parse a GitHub URL to extract owner and repo
   * @param url - The GitHub remote URL
   * @returns The owner and repo
   */
  private parseGitHubUrl(url: string): { owner: string; repo: string } {
    // Handle SSH URLs: git@github.com:owner/repo.git
    if (url.startsWith('git@github.com:')) {
      const match = url.match(/git@github\.com:([^/]+)\/([^.]+)(.git)?$/);
      if (match && match[1] && match[2]) {
        return { owner: match[1], repo: match[2] };
      }
    }

    // Handle HTTPS URLs: https://github.com/owner/repo.git
    if (url.includes('github.com')) {
      const match = url.match(/github\.com\/([^/]+)\/([^.]+)(.git)?$/);
      if (match && match[1] && match[2]) {
        return { owner: match[1], repo: match[2] };
      }
    }

    throw new Error(`Unable to parse GitHub URL: ${url}`);
  }

  /**
   * Parse a GitLab URL to extract the project path
   * @param url - The GitLab remote URL
   * @returns The GitLab URL and project path
   */
  private parseGitLabUrl(url: string): { url: string; projectPath: string } {
    let gitlabUrl = 'https://gitlab.com';
    let projectPath = '';

    // Handle SSH URLs: git@gitlab.com:group/project.git
    if (url.startsWith('git@')) {
      const match = url.match(/git@([^:]+):(.+?)(.git)?$/);
      if (match && match[1] && match[2]) {
        gitlabUrl = `https://${match[1]}`;
        projectPath = match[2];
      }
    }
    // Handle HTTPS URLs: https://gitlab.com/group/project.git
    else if (url.startsWith('http')) {
      const parsedUrl = new URL(url);
      gitlabUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

      // Remove .git suffix if present
      const pathWithoutGit = parsedUrl.pathname.replace(/\.git$/, '');
      projectPath = pathWithoutGit.startsWith('/') ? pathWithoutGit.slice(1) : pathWithoutGit;
    }

    if (!projectPath) {
      throw new Error(`Unable to extract project path from GitLab URL: ${url}`);
    }

    return {
      url: gitlabUrl || 'https://gitlab.com',
      projectPath: projectPath || '',
    };
  }
}
