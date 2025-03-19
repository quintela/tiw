import axios from 'axios';

import { GitAdapter } from './GitAdapter';

export interface GitHubPRParams {
  owner: string;
  repo: string;
  pullNumber: string;
}

/**
 * Adapter for GitHub platform
 */
export class GitHubAdapter extends GitAdapter {
  /**
   * Parse a GitHub PR URL to extract owner, repo, and PR number
   * @param url - The URL to parse
   * @returns Object containing owner, repo, and pullNumber
   * @throws If URL is invalid or cannot be parsed
   */
  parseRequestUrl(url: string): Record<string, string> {
    try {
      const parsedUrl = new URL(url);

      // Expected format: https://github.com/owner/repo/pull/123
      const pathParts = parsedUrl.pathname.split('/');

      if (pathParts.length < 5 || pathParts[3] !== 'pull') {
        throw new Error('Invalid GitHub PR URL format');
      }

      const owner = pathParts[1] ?? '';
      const repo = pathParts[2] ?? '';
      const pullNumber = pathParts[4] ?? '';

      return { owner, repo, pullNumber };
    } catch (error) {
      console.error('Error parsing GitHub PR URL:', (error as Error).message);
      throw new Error(`Invalid GitHub PR URL: ${url}`);
    }
  }

  /**
   * Get the diff of a pull request from GitHub
   * @param params - Parameters with owner, repo, and pullNumber
   * @returns The diff content
   */
  async getRequestDiff(params: Record<string, string>): Promise<string> {
    const ghParams = params as unknown as GitHubPRParams;
    try {
      // GitHub API returns the diff directly with the right Accept header
      const url = `https://api.github.com/repos/${ghParams.owner}/${ghParams.repo}/pulls/${ghParams.pullNumber}`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${(this as any).config.githubToken || ''}`,
          Accept: 'application/vnd.github.v3.diff',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching PR diff from GitHub:', (error as Error).message);
      if (axios.isAxiosError(error) && error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Post a comment on a GitHub pull request
   * @param params - Parameters with owner, repo, and pullNumber
   * @param comment - The comment content
   */
  async commentOnRequest(params: Record<string, string>, comment: string): Promise<void> {
    const ghParams = params as unknown as GitHubPRParams;
    try {
      const url = `https://api.github.com/repos/${ghParams.owner}/${ghParams.repo}/issues/${ghParams.pullNumber}/comments`;

      await axios.post(
        url,
        { body: `## LLM Code Review Feedback\n\n${comment}` },
        {
          headers: {
            Authorization: `Bearer ${(this as any).config.githubToken || ''}`,
            Accept: 'application/vnd.github.v3+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }
      );
    } catch (error) {
      console.error('Error posting comment on PR:', (error as Error).message);
      if (axios.isAxiosError(error) && error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw error;
    }
  }
}
