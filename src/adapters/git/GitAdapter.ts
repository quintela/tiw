import { execSync } from 'node:child_process';

import type { AppConfig } from '../../config/config';

/**
 * Result of a git command execution
 */
interface GitCommandResult {
  success: boolean;
  output: string;
  error?: Error;
}

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
   * Execute a git command safely
   *
   * @param command The git command to execute
   * @param options Options for command execution
   * @returns Result of the command execution
   */
  private executeGitCommand(
    command: string,
    options: { cwd?: string; stdio?: 'ignore' | 'pipe' } = {}
  ): GitCommandResult {
    try {
      const output = execSync(command, options).toString().trim();
      return { success: true, output };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error as Error,
      };
    }
  }

  /**
   * Get the current branch name
   *
   * @returns Current branch name or empty string if not found
   */
  private getCurrentBranch(): string {
    const result = this.executeGitCommand('git rev-parse --abbrev-ref HEAD');

    if (!result.success || !result.output) {
      console.warn('Could not determine current branch');
      return '';
    }

    return result.output;
  }

  /**
   * Check if there are local changes (staged or unstaged)
   *
   * @returns True if there are changes, false otherwise
   */
  private hasLocalChanges(): boolean {
    // Check for unstaged changes
    const unstagedResult = this.executeGitCommand('git diff --name-only');

    // Check for staged changes
    const stagedResult = this.executeGitCommand('git diff --cached --name-only');

    return (
      (unstagedResult.success && unstagedResult.output.length > 0) ||
      (stagedResult.success && stagedResult.output.length > 0)
    );
  }

  /**
   * Get only the unstaged changes (working directory changes)
   *
   * @returns Diff of unstaged changes
   */
  private getUnstagedChanges(): string {
    const result = this.executeGitCommand('git diff');

    if (!result.success) {
      console.warn('Failed to get unstaged changes');
      return '';
    }

    return result.output;
  }

  /**
   * Get only the staged changes
   *
   * @returns Diff of staged changes
   */
  private getStagedChanges(): string {
    const result = this.executeGitCommand('git diff --cached');

    if (!result.success) {
      console.warn('Failed to get staged changes');
      return '';
    }

    return result.output;
  }

  /**
   * Get all local changes (staged and unstaged)
   *
   * @returns Combined diff of all local changes
   */
  private getAllLocalChanges(): string {
    // First check if there are any changes
    if (!this.hasLocalChanges()) {
      return '';
    }

    const unstaged = this.getUnstagedChanges();
    const staged = this.getStagedChanges();

    // Combine the diffs with a separator if both exist
    if (unstaged && staged) {
      return `${staged}\n\n# UNSTAGED CHANGES\n\n${unstaged}`;
    }

    return unstaged || staged;
  }

  /**
   * Get changes for CI mode
   *
   * @returns The staged changes in CI mode
   */
  private getCIModeChanges(): string {
    const stagedChanges = this.getStagedChanges();

    if (!stagedChanges) {
      throw new Error('No staged changes found in CI mode');
    }

    return stagedChanges;
  }

  /**
   * Compare current branch with target branch
   *
   * @param targetBranch Branch to compare against
   * @returns Diff between current branch and target branch
   */
  private compareWithTargetBranch(targetBranch: string): string {
    // Verify branch exists
    const verifyResult = this.executeGitCommand(`git rev-parse --verify ${targetBranch}`, {
      stdio: 'ignore',
    });

    if (!verifyResult.success) {
      throw new Error(`Target branch '${targetBranch}' does not exist`);
    }

    // Get the diff between current branch and target branch
    let diffCommand = `git diff ${targetBranch}...HEAD`;

    // Add option to exclude lock files if configured
    if (this.config.ignoreLockFiles) {
      diffCommand +=
        " -- . ':(exclude)yarn.lock' ':(exclude)package-lock.json' ':(exclude)pnpm-lock.yaml'";
    }

    const diffResult = this.executeGitCommand(diffCommand, { cwd: process.cwd() });

    if (!diffResult.success) {
      throw new Error(`Failed to get diff against ${targetBranch}`);
    }

    return diffResult.output;
  }

  /**
   * Check if branch exists on remote
   *
   * @param branchName Name of the branch to check
   * @returns True if the branch exists on remote
   */
  private branchExistsOnRemote(branchName: string): boolean {
    const result = this.executeGitCommand(`git ls-remote --heads origin ${branchName}`);
    return result.success && result.output.length > 0;
  }

  /**
   * Get the commit count for a branch
   *
   * @returns Number of commits in the branch
   */
  private getCommitCount(): number {
    const result = this.executeGitCommand('git rev-list --count HEAD');
    if (!result.success) {
      return 0;
    }
    return parseInt(result.output, 10) || 0;
  }

  /**
   * Get diff between current HEAD and previous commit
   *
   * @returns Diff with previous commit
   */
  private getDiffWithPreviousCommit(): string {
    if (this.getCommitCount() <= 0) {
      return '';
    }

    const result = this.executeGitCommand('git diff HEAD~1...HEAD');
    if (!result.success) {
      return '';
    }

    console.log('[INFO] Comparing with previous commit');
    return result.output;
  }

  /**
   * Compare current branch with remote of same name
   *
   * @param branchName Current branch name
   * @returns Diff with remote counterpart
   */
  private compareWithRemote(branchName: string): string {
    const result = this.executeGitCommand(`git diff origin/${branchName}...HEAD`);

    if (!result.success || !result.output) {
      return '';
    }

    console.log('[INFO] Found unpushed commits, analyzing these changes');
    return result.output;
  }

  /**
   * Find common ancestor with another branch and get diff
   *
   * @param baseBranch Base branch to find common ancestor with
   * @returns Diff from common ancestor
   */
  private compareWithMergeBase(baseBranch: string): string {
    // Try to find merge-base (common ancestor)
    const mergeBaseResult = this.executeGitCommand(`git merge-base HEAD origin/${baseBranch}`);

    if (!mergeBaseResult.success || !mergeBaseResult.output) {
      return '';
    }

    const mergeBase = mergeBaseResult.output;
    const diffResult = this.executeGitCommand(`git diff ${mergeBase}...HEAD`);

    return diffResult.success ? diffResult.output : '';
  }

  /**
   * Direct comparison with a base branch
   *
   * @param baseBranch Base branch to compare with
   * @returns Diff with base branch
   */
  private compareWithBaseBranch(baseBranch: string): string {
    const result = this.executeGitCommand(`git diff origin/${baseBranch}...HEAD`);
    return result.success ? result.output : '';
  }

  /**
   * Try to find a suitable base branch for comparison
   *
   * @returns Diff using the first successful comparison strategy
   */
  private findAndCompareWithBaseBranch(): string {
    const possibleBaseBranches = ['main', 'master', 'develop', 'development'];

    for (const baseBranch of possibleBaseBranches) {
      if (!this.branchExistsOnRemote(baseBranch)) {
        continue;
      }

      console.log(`[INFO] Using ${baseBranch} as base branch for comparison`);

      // Try merge-base approach first
      const mergeBaseDiff = this.compareWithMergeBase(baseBranch);
      if (mergeBaseDiff) {
        return mergeBaseDiff;
      }

      // Fall back to direct comparison
      const directDiff = this.compareWithBaseBranch(baseBranch);
      if (directDiff) {
        return directDiff;
      }
    }

    return '';
  }

  /**
   * Get unpushed commits or changes on a new branch
   *
   * @returns Diff of changes compared to appropriate base
   */
  private getUnpushedCommits(): string {
    const currentBranch = this.getCurrentBranch();

    if (!currentBranch) {
      throw new Error('No current branch detected');
    }

    // Strategy 1: Compare with remote branch if it exists
    if (this.branchExistsOnRemote(currentBranch)) {
      const remoteDiff = this.compareWithRemote(currentBranch);
      if (remoteDiff) {
        return remoteDiff;
      }
    }

    // Strategy 2: Compare with a suitable base branch
    console.log('[INFO] Branch not found on remote, comparing with likely base branch');
    const baseBranchDiff = this.findAndCompareWithBaseBranch();
    if (baseBranchDiff) {
      return baseBranchDiff;
    }

    // Strategy 3: Compare with previous commit as last resort
    return this.getDiffWithPreviousCommit();
  }

  /**
   * Get the local git diff comparing to a target branch
   * @param targetBranch - The branch to compare against (defaults to current branch with local changes)
   * @returns The diff content
   */
  async getLocalDiff(targetBranch?: string): Promise<string> {
    try {
      // Check if we're in CI mode
      if (this.config.mrMode === 'ci') {
        return this.getCIModeChanges();
      }

      // TODO(FIXME): need a better usage here
      // let changes = '';
      // If there are local changes, return them directly
      if (this.hasLocalChanges()) {
        console.log('[INFO] Local changes detected, analyzing working directory changes');
        // changes = this.getAllLocalChanges();
        return this.getAllLocalChanges();
      }

      // If no local changes but a target branch is specified, compare current branch to target
      if (targetBranch) {
        // changes += this.compareWithTargetBranch();
        return this.compareWithTargetBranch(targetBranch);
      }

      // If no target branch and no local changes, check if there are unpushed commits
      const unpushedChanges = this.getUnpushedCommits();
      if (unpushedChanges) {
        // changes += unpushedChanges;
        return unpushedChanges;
      }

      // Last resort - no changes detected
      throw new Error('No changes detected to analyze');
    } catch (error) {
      console.error('Error getting local git diff:', (error as Error).message);
      throw error;
    }
  }
}
