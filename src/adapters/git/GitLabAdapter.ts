import axios from 'axios';

import { GitAdapter } from './GitAdapter';

export interface GitLabMRParams {
  projectId: string;
  mergeRequestIid: string;
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
      const parsedUrl = new URL(url);

      // Set the gitlabUrl in the config to the origin from the URL
      // This ensures we're using the correct GitLab instance
      (this as any).config.gitlabUrl = parsedUrl.origin;

      // Expected format: https://git.domain.com/group/project/-/merge_requests/123
      const pathParts = parsedUrl.pathname.split('/');
      const mrIndex = pathParts.findIndex(part => part === 'merge_requests');

      if (mrIndex === -1 || mrIndex + 1 >= pathParts.length) {
        throw new Error('Invalid GitLab MR URL format');
      }

      const mergeRequestIid = pathParts[mrIndex + 1];

      // Find the position of '-' before 'merge_requests' to properly split the project path
      let dashIndex = -1;
      for (let i = 0; i < mrIndex; i++) {
        if (pathParts[i] === '-') {
          dashIndex = i;
          break;
        }
      }

      // Skip the first empty element if pathname starts with /
      const startIndex = pathParts[0] === '' ? 1 : 0;

      // Get project path - everything between start and the merge_requests indicator
      let projectPath;
      if (dashIndex > 0) {
        // If we found a dash, extract the path up to the dash
        projectPath = pathParts.slice(startIndex, dashIndex).join('/');
      } else {
        // If no dash, take everything before 'merge_requests'
        projectPath = pathParts.slice(startIndex, mrIndex - 1).join('/');
      }

      // GitLab API can use either a project ID (number) or a URL-encoded path
      // Try to determine if the project path is numeric (a project ID) or a path
      let projectId: string;

      if (/^\d+$/.test(projectPath)) {
        // If it's just a number, use it directly as a project ID
        projectId = projectPath;
      } else {
        // Otherwise URL encode the path for the API
        projectId = encodeURIComponent(projectPath || '');
      }

      const result: Record<string, string> = {
        projectId,
        mergeRequestIid: mergeRequestIid || '',
      };
      return result;
    } catch (error) {
      console.error('Error parsing GitLab MR URL:', (error as Error).message);
      throw new Error(`Invalid GitLab MR URL: ${url}`);
    }
  }

  /**
   * Get the diff of a merge request from GitLab
   * @param params - Parameters with projectId and mergeRequestIid
   * @returns The diff content
   */
  async getRequestDiff(params: Record<string, string>): Promise<string> {
    const glParams = params as unknown as GitLabMRParams;
    try {
      // The projectId should already be URL encoded from parseRequestUrl
      const projectId = glParams.projectId;

      const url = `${(this as any).config.gitlabUrl}/api/v4/projects/${projectId}/merge_requests/${glParams.mergeRequestIid}/changes`;

      const response = await axios.get(url, {
        headers: { 'PRIVATE-TOKEN': (this as any).config.gitlabToken || '' },
      });

      // Extract the diff from each file
      return response.data.changes
        .map(
          (change: { new_path: string; diff: string }) => `File: ${change.new_path}\n${change.diff}`
        )
        .join('\n\n');
    } catch (error) {
      console.error('Error fetching MR diff from GitLab:', (error as Error).message);
      if (axios.isAxiosError(error) && error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Post a comment on a GitLab merge request
   * @param params - Parameters with projectId and mergeRequestIid
   * @param comment - The comment content
   */
  async commentOnRequest(params: Record<string, string>, comment: string): Promise<void> {
    const glParams = params as unknown as GitLabMRParams;
    try {
      // The projectId should already be URL encoded from parseRequestUrl
      const projectId = glParams.projectId;

      const url = `${(this as any).config.gitlabUrl}/api/v4/projects/${projectId}/merge_requests/${glParams.mergeRequestIid}/notes`;

      await axios.post(
        url,
        { body: `## LLM Code Review Feedback\n\n${comment}` },
        { headers: { 'PRIVATE-TOKEN': (this as any).config.gitlabToken || '' } }
      );
    } catch (error) {
      console.error('Error posting comment on MR:', (error as Error).message);
      if (axios.isAxiosError(error) && error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw error;
    }
  }
}
