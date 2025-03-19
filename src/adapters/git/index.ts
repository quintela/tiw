import type { AppConfig } from '../../config/config';
import { GitAdapter } from './GitAdapter';
import { GitHubAdapter } from './GitHubAdapter';
import { GitLabAdapter } from './GitLabAdapter';

/**
 * Factory for creating Git platform adapters
 */
export class GitAdapterFactory {
  /**
   * Instance of GitAdapterFactory for singleton usage
   */
  private static instance: GitAdapterFactory;

  /**
   * Get singleton instance of GitAdapterFactory
   * @returns The GitAdapterFactory instance
   */
  public static getInstance(): GitAdapterFactory {
    if (!GitAdapterFactory.instance) {
      GitAdapterFactory.instance = new GitAdapterFactory();
    }
    return GitAdapterFactory.instance;
  }
  /**
   * Create a new Git adapter based on configuration
   * @param config - The configuration object
   * @returns The appropriate Git adapter
   * @throws If platform is unsupported
   */
  create(config: AppConfig): GitAdapter {
    const platform = config.gitPlatform.toLowerCase();

    switch (platform) {
      case 'gitlab':
        return new GitLabAdapter(config);
      case 'github':
        return new GitHubAdapter(config);
      default:
        throw new Error(`Unsupported Git platform: ${platform}`);
    }
  }
}

export { GitAdapter };
