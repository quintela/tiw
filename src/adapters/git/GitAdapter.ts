import { execSync } from 'node:child_process';

import type { AppConfig } from '../../config/config';

/**
 * Base abstract class for Git adapters
 * Defines the interface that all Git adapters must implement
 */
export abstract class GitAdapter {
  protected config: AppConfig;

  /**
   * Create a new Git adapter
   * @param config - The configuration for the Git platform
   */
  constructor(config: AppConfig) {
    if (this.constructor === GitAdapter) {
      throw new Error('GitAdapter is an abstract class and cannot be instantiated directly');
    }

    this.config = config;
  }

  /**
   * Parse a Git MR/PR URL into project and request identifiers
   * @param url - The URL to parse
   * @returns Object containing platform-specific identifiers
   */
  /* eslint-disable-next-line no-unused-vars */
  abstract parseRequestUrl(_url: string): Record<string, string>;

  /**
   * Get the diff of a merge/pull request
   * @param params - Parameters needed to identify the MR/PR
   * @returns The diff content
   */
  /* eslint-disable-next-line no-unused-vars */
  abstract getRequestDiff(_params: Record<string, string>): Promise<string>;

  /**
   * Post a comment on a merge/pull request
   * @param params - Parameters needed to identify the MR/PR
   * @param comment - The comment content
   */
  /* eslint-disable-next-line no-unused-vars */
  abstract commentOnRequest(_params: Record<string, string>, _comment: string): Promise<void>;

  /**
   * Get the default branch from remote origin with fresh data
   * @returns The name of the default branch
   */
  private getDefaultBranch(): string {
    try {
      // Fetch from origin to ensure we have the latest refs
      execSync('git fetch origin --prune', { stdio: 'ignore' });

      // Approach 1: Get the remote HEAD directly from branch listing
      const output = execSync('git branch -r').toString().trim();
      const headLine = output.split('\n').find(line => line.includes('origin/HEAD'));

      if (headLine) {
        // Extract the branch name from a line like "  remotes/origin/HEAD -> origin/master"
        const match = headLine.match(/origin\/HEAD\s+->\s+origin\/(\S+)/);
        if (match && match[1]) {
          const defaultBranch = match[1];

          // Ensure the default branch is up to date
          try {
            execSync(`git fetch origin ${defaultBranch}:${defaultBranch}`, { stdio: 'ignore' });
          } catch (fetchError) {
            console.warn(`Failed to fetch ${defaultBranch} branch:`, (fetchError as Error).message);
          }

          return defaultBranch;
        }
      }

      // Approach 2: Try using a different git command if approach 1 fails
      const symbolOutput = execSync('git remote show origin | grep "HEAD branch"')
        .toString()
        .trim();
      const headMatch = symbolOutput.match(/HEAD branch:\s+(\S+)/);
      if (headMatch && headMatch[1]) {
        const defaultBranch = headMatch[1];

        // Ensure the default branch is up to date
        try {
          execSync(`git fetch origin ${defaultBranch}:${defaultBranch}`, { stdio: 'ignore' });
        } catch (fetchError) {
          console.warn(`Failed to fetch ${defaultBranch} branch:`, (fetchError as Error).message);
        }

        return defaultBranch;
      }

      // Fallback to a common default
      console.warn('Could not determine default branch from remote, using "master" as fallback');
      // Try to fetch master as a fallback
      try {
        execSync('git fetch origin master:master', { stdio: 'ignore' });
      } catch (fetchError) {
        console.warn('Failed to fetch master branch:', (fetchError as Error).message);
      }
      return 'master';
    } catch (error) {
      console.warn(
        'Could not determine default branch from remote, using "master" as fallback',
        error
      );
      // Try to fetch master as a fallback
      try {
        execSync('git fetch origin master:master', { stdio: 'ignore' });
      } catch (fetchError) {
        console.warn('Failed to fetch master branch:', (fetchError as Error).message);
      }
      return 'master';
    }
  }

  /**
   * Get the local git diff comparing to a target branch
   * @param targetBranch - The branch to compare against (defaults to remote's default branch)
   * @returns The diff content
   */
  async getLocalDiff(targetBranch?: string): Promise<string> {
    // If no target branch provided, use the default branch from remote
    const branchToCompare = targetBranch || this.getDefaultBranch();

    if (!branchToCompare) {
      throw new Error('Target branch must be specified');
    }

    try {
      // First check if we're in CI mode where we already know what to diff
      if (this.config.mrMode === 'ci') {
        // In CI mode, there should already be a well-defined target diff
        return execSync('git diff --staged').toString();
      }

      // Otherwise, get the diff between the current branch and target branch
      const branchExistsCmd = `git rev-parse --verify ${branchToCompare}`;

      try {
        // Check if branch exists
        execSync(branchExistsCmd, { stdio: 'ignore' });
      } catch (/* eslint-disable-line @typescript-eslint/no-unused-vars, no-unused-vars */ _error) {
        throw new Error(`Target branch '${branchToCompare}' does not exist`);
      }

      // Build the git diff command with appropriate options
      let diffCommand = `git diff ${branchToCompare}...HEAD`;

      // Add option to exclude lock files if configured
      if (this.config.ignoreLockFiles) {
        diffCommand +=
          " -- . ':(exclude)yarn.lock' ':(exclude)package-lock.json' ':(exclude)pnpm-lock.yaml'";
      }

      // Get the diff between current HEAD and target branch, ensure we run in the current working directory
      return execSync(diffCommand, { cwd: process.cwd() }).toString();
    } catch (error) {
      console.error('Error getting local git diff:', (error as Error).message);
      throw error;
    }
  }
}
