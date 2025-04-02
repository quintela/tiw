import axios from 'axios';

import { GitAdapter } from './GitAdapter';

export interface GitLabMRParams {
  projectId: string;
  mergeRequestIid: string;
}

/**
 * Represents a parsed GitLab URL
 */
interface ParsedGitLabUrl {
  origin: string;
  projectId: string;
  mergeRequestIid: string;
}

/**
 * Represents a GitLab file change
 */
interface GitLabFileChange {
  new_path: string;
  diff: string;
}

/**
 * Adapter for GitLab platform
 */
export class GitLabAdapter extends GitAdapter {
  /**
   * Parse a GitLab MR URL to extract project ID and MR IID
   * @param url - The URL to parse
   * @returns Object containing projectPath and mergeRequestIid
   * @throws If URL is invalid or cannot be parsed
   */
  parseRequestUrl(url: string): Record<string, string> {
    try {
      const parsedUrl = this.parseUrl(url);

      // Set the gitlabUrl in the config to the origin from the URL
      // This ensures we're using the correct GitLab instance
      (this as any).config.gitlabUrl = parsedUrl.origin;

      return {
        projectId: parsedUrl.projectId,
        mergeRequestIid: parsedUrl.mergeRequestIid,
      };
    } catch (error) {
      console.error('Error parsing GitLab MR URL:', (error as Error).message);
      throw new Error(`Invalid GitLab MR URL: ${url}`);
    }
  }

  /**
   * Parse a GitLab URL into its components
   *
   * @param url URL to parse
   * @returns Parsed URL components
   */
  private parseUrl(url: string): ParsedGitLabUrl {
    const parsedUrl = new URL(url);
    const pathParts = parsedUrl.pathname.split('/');

    const mergeRequestIid = this.extractMergeRequestId(pathParts);
    const projectId = this.extractProjectId(pathParts);

    return {
      origin: parsedUrl.origin,
      projectId,
      mergeRequestIid,
    };
  }

  /**
   * Extract the merge request ID from URL path parts
   *
   * @param pathParts Split path components
   * @returns Merge request ID
   */
  private extractMergeRequestId(pathParts: string[]): string {
    const mrIndex = pathParts.findIndex(part => part === 'merge_requests');

    if (mrIndex === -1 || mrIndex + 1 >= pathParts.length) {
      throw new Error('Invalid GitLab MR URL format');
    }

    const mergeRequestId = pathParts[mrIndex + 1];
    if (mergeRequestId === undefined) {
      throw new Error('Merge request ID not found in URL');
    }

    return mergeRequestId;
  }

  /**
   * Extract project ID from URL path parts
   *
   * @param pathParts Split path components
   * @returns Project ID or encoded project path
   */
  private extractProjectId(pathParts: string[]): string {
    const mrIndex = pathParts.findIndex(part => part === 'merge_requests');
    if (mrIndex === -1) {
      throw new Error('Could not find merge_requests in URL');
    }

    // Find the position of '-' before 'merge_requests'
    const dashIndex = this.findDashIndex(pathParts, mrIndex);

    // Skip the first empty element if pathname starts with /
    const startIndex = pathParts[0] === '' ? 1 : 0;

    // Get project path based on whether we found a dash
    const projectPath = this.buildProjectPath(pathParts, startIndex, dashIndex, mrIndex);

    return this.normalizeProjectId(projectPath);
  }

  /**
   * Find the dash index before merge_requests
   *
   * @param pathParts Split path components
   * @param mrIndex Index of merge_requests
   * @returns Index of dash or -1 if not found
   */
  private findDashIndex(pathParts: string[], mrIndex: number): number {
    for (let i = 0; i < mrIndex; i++) {
      if (pathParts[i] === '-') {
        return i;
      }
    }
    return -1;
  }

  /**
   * Build the project path from path parts
   *
   * @param pathParts Split path components
   * @param startIndex Starting index
   * @param dashIndex Index of dash
   * @param mrIndex Index of merge_requests
   * @returns Project path
   */
  private buildProjectPath(
    pathParts: string[],
    startIndex: number,
    dashIndex: number,
    mrIndex: number
  ): string {
    if (dashIndex > 0) {
      // If we found a dash, extract the path up to the dash
      return pathParts.slice(startIndex, dashIndex).join('/');
    }
    // If no dash, take everything before 'merge_requests'
    return pathParts.slice(startIndex, mrIndex - 1).join('/');
  }

  /**
   * Normalize project ID by either using directly if numeric or encoding
   *
   * @param projectPath Raw project path from URL
   * @returns Normalized project ID
   */
  private normalizeProjectId(projectPath: string): string {
    // Try to determine if the project path is numeric (a project ID) or a path
    if (/^\d+$/.test(projectPath)) {
      // If it's just a number, use it directly as a project ID
      return projectPath;
    }
    // Otherwise URL encode the path for the API
    return encodeURIComponent(projectPath || '');
  }

  /**
   * Get the diff of a merge request from GitLab
   * @param params - Parameters with projectId and mergeRequestIid
   * @returns The diff content
   */
  async getRequestDiff(params: Record<string, string>): Promise<string> {
    const glParams = params as unknown as GitLabMRParams;
    try {
      const response = await this.fetchMergeRequestChanges(glParams);
      return this.formatDiffFromChanges(response.data.changes);
    } catch (error) {
      return this.handleDiffError(error);
    }
  }

  /**
   * Fetch merge request changes from GitLab API
   *
   * @param params GitLab MR parameters
   * @returns API response
   */
  private async fetchMergeRequestChanges(params: GitLabMRParams) {
    const url = this.buildMergeRequestUrl(params, 'changes');
    return await axios.get(url, {
      headers: this.getRequestHeaders(),
    });
  }

  /**
   * Build GitLab API URL for merge request
   *
   * @param params GitLab MR parameters
   * @param endpoint API endpoint
   * @returns Complete API URL
   */
  private buildMergeRequestUrl(params: GitLabMRParams, endpoint: string): string {
    return `${(this as any).config.gitlabUrl}/api/v4/projects/${params.projectId}/merge_requests/${params.mergeRequestIid}/${endpoint}`;
  }

  /**
   * Get request headers for GitLab API
   *
   * @returns Headers object with token
   */
  private getRequestHeaders() {
    return {
      'PRIVATE-TOKEN': (this as any).config.gitlabToken || '',
    };
  }

  /**
   * Format diff text from GitLab file changes
   *
   * @param changes Array of file changes
   * @returns Formatted diff text
   */
  private formatDiffFromChanges(changes: GitLabFileChange[]): string {
    return changes.map(change => `File: ${change.new_path}\n${change.diff}`).join('\n\n');
  }

  /**
   * Handle errors from diff request
   *
   * @param error Error from API request
   * @throws Original error after logging
   */
  private handleDiffError(error: unknown): never {
    console.error('Error fetching MR diff from GitLab:', (error as Error).message);

    if (axios.isAxiosError(error) && error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }

    throw error;
  }

  /**
   * Post a comment on a GitLab merge request
   * @param params - Parameters with projectId and mergeRequestIid
   * @param comment - The comment content
   */
  async commentOnRequest(params: Record<string, string>, comment: string): Promise<void> {
    const glParams = params as unknown as GitLabMRParams;
    try {
      await this.postMergeRequestComment(glParams, comment);
    } catch (error) {
      this.handleCommentError(error);
    }
  }

  /**
   * Post comment to GitLab API
   *
   * @param params GitLab MR parameters
   * @param comment Comment text
   */
  private async postMergeRequestComment(params: GitLabMRParams, comment: string): Promise<void> {
    const url = this.buildMergeRequestUrl(params, 'notes');
    const formattedComment = this.formatComment(comment);

    await axios.post(url, { body: formattedComment }, { headers: this.getRequestHeaders() });
  }

  /**
   * Format comment text with heading
   *
   * @param comment Raw comment text
   * @returns Formatted comment text
   */
  private formatComment(comment: string): string {
    return `## LLM Code Review Feedback\n\n${comment}`;
  }

  /**
   * Handle errors from comment request
   *
   * @param error Error from API request
   * @throws Original error after logging
   */
  private handleCommentError(error: unknown): never {
    console.error('Error posting comment on MR:', (error as Error).message);

    if (axios.isAxiosError(error) && error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }

    throw error;
  }
}
