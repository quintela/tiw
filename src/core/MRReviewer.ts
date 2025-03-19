import readline from 'node:readline';

import { GitAdapterFactory } from '../adapters/git';
import type { GitAdapter } from '../adapters/git/GitAdapter';
import { LLMAdapterFactory } from '../adapters/llm';
import type { LLMAdapter } from '../adapters/llm/LLMAdapter';
import type { AppConfig } from '../config/config';
import { FileUtils } from '../utils/fileUtils';
import { Logger } from '../utils/logging';
import { ReviewFormatter } from './ReviewFormatter';

/**
 * Main class for performing MR/PR reviews
 */
export class MRReviewer {
  private config: AppConfig;
  private llmAdapter: LLMAdapter;
  private gitAdapter: GitAdapter;
  private formatter: ReviewFormatter;
  private fileUtils: FileUtils;
  private logger: Logger;
  private promptTemplate: string;

  /**
   * Create a new MR reviewer
   * @param config - The loaded and validated configuration
   */
  constructor(config: AppConfig) {
    this.config = config;
    this.logger = new Logger(config.verbose);
    this.fileUtils = new FileUtils();

    // Create adapters using factories
    const llmFactory = new LLMAdapterFactory();
    const gitFactory = new GitAdapterFactory();

    this.llmAdapter = llmFactory.create(config);
    this.gitAdapter = gitFactory.create(config);

    // Create formatter with the configured template
    this.formatter = new ReviewFormatter(config.formatterTemplate);

    // Load prompt template from directory
    this.promptTemplate = this.fileUtils.loadPromptFromDirectory(config.promptDir);
  }

  /**
   * Get MR/PR diff based on the configured mode
   * @returns The diff content
   */
  async getDiff(): Promise<string> {
    try {
      if (
        this.config.mrMode === 'ci' &&
        process.env['CI_PIPELINE_SOURCE'] === 'merge_request_event'
      ) {
        // Running in CI mode
        this.logger.info('Running in CI mode, fetching diff from Git platform API');

        if (this.config.gitPlatform === 'gitlab') {
          return await this.gitAdapter.getRequestDiff({
            projectId: this.config.projectId || '',
            mergeRequestIid: this.config.mergeRequestIid || '',
          });
        }
        if (this.config.gitPlatform === 'github') {
          // Handle GitHub CI mode (needs additional environment variables)
          // This would need to be expanded based on GitHub Actions environment
          throw new Error('GitHub CI mode not fully implemented yet');
        }
      } else if (this.config.mrMode === 'url') {
        // Running with a Git MR/PR URL
        if (!this.config.gitMrUrl) {
          throw new Error('Git MR/PR URL is required for URL mode');
        }

        // Determine correct platform from URL
        const url = this.config.gitMrUrl.toLowerCase();
        const actualPlatform = this.config.gitPlatform;

        // Helper function to detect URL type
        const isGitHubUrl = (u: string) => u.includes('github.com') || u.includes('/pull/');
        const isGitLabUrl = (u: string) =>
          u.includes('gitlab') || u.includes('-/merge_requests/') || u.includes('/merge_requests/');

        // Auto-detect platform from URL if it doesn't match current platform
        if (isGitHubUrl(url) && this.config.gitPlatform !== 'github') {
          this.logger.info(
            'URL appears to be GitHub, but platform is set to GitLab. Switching to GitHub adapter.'
          );
          // Create a GitHub adapter specifically for this request
          const gitFactory = new GitAdapterFactory();
          const tempConfig = { ...this.config, gitPlatform: 'github' as const };
          const githubAdapter = gitFactory.create(tempConfig);

          const parsedUrl = githubAdapter.parseRequestUrl(this.config.gitMrUrl);
          return await githubAdapter.getRequestDiff(parsedUrl);
        }
        if (isGitLabUrl(url) && this.config.gitPlatform !== 'gitlab') {
          this.logger.info(
            'URL appears to be GitLab, but platform is set to GitHub. Switching to GitLab adapter.'
          );
          // Create a GitLab adapter specifically for this request
          const gitFactory = new GitAdapterFactory();
          const tempConfig = { ...this.config, gitPlatform: 'gitlab' as const };
          const gitlabAdapter = gitFactory.create(tempConfig);

          const parsedUrl = gitlabAdapter.parseRequestUrl(this.config.gitMrUrl);
          return await gitlabAdapter.getRequestDiff(parsedUrl);
        }

        this.logger.info(`Running in URL mode, fetching diff from ${actualPlatform} API using URL`);

        // Parse the URL to get appropriate identifiers
        const parsedUrl = this.gitAdapter.parseRequestUrl(this.config.gitMrUrl);

        return await this.gitAdapter.getRequestDiff(parsedUrl);
      } else {
        // Running locally for testing
        this.logger.info('Running in local mode, fetching diff from local git');
        return await this.gitAdapter.getLocalDiff();
      }

      // This should never be reached, but TypeScript needs a return value
      throw new Error('Unsupported Git platform or MR mode');
    } catch (error) {
      this.logger.error('Error getting MR/PR diff:', error as Error);
      throw error;
    }
  }

  /**
   * Analyze the diff with the configured LLM
   * @param diff - The code diff to analyze
   * @returns The LLM feedback
   */
  async analyzeDiff(diff: string): Promise<string> {
    try {
      const prompt = this.promptTemplate.replace('{{diff}}', diff);
      this.logger.info(`Analyzing diff with ${this.config.llmProvider} LLM...`);

      // Only print the prompt in verbose mode - it can be very large
      if (this.config.verbose) {
        this.logger.debug(`Prompt length: ${prompt.length} characters`);
      }

      return await this.llmAdapter.analyzeCode(prompt);
    } catch (error) {
      this.logger.error('Error analyzing diff with LLM:', error as Error);
      throw error;
    }
  }

  /**
   * Post the review comment on the MR/PR
   * @param feedback - The formatted feedback
   */
  async postComment(feedback: string): Promise<void> {
    try {
      if (this.config.mrMode === 'url') {
        // Post comment using the URL
        if (!this.config.gitMrUrl) {
          throw new Error('Git MR/PR URL is required for URL mode');
        }

        // Determine correct platform from URL for commenting
        const url = this.config.gitMrUrl.toLowerCase();

        // Helper function to detect URL type
        const isGitHubUrl = (u: string) => u.includes('github.com') || u.includes('/pull/');
        const isGitLabUrl = (u: string) =>
          u.includes('gitlab') || u.includes('-/merge_requests/') || u.includes('/merge_requests/');

        if (isGitHubUrl(url) && this.config.gitPlatform !== 'github') {
          this.logger.info('URL appears to be GitHub, using GitHub adapter for commenting.');
          // Create a GitHub adapter specifically for this request
          const gitFactory = new GitAdapterFactory();
          const tempConfig = { ...this.config, gitPlatform: 'github' as const };
          const githubAdapter = gitFactory.create(tempConfig);

          const parsedUrl = githubAdapter.parseRequestUrl(this.config.gitMrUrl);
          await githubAdapter.commentOnRequest(parsedUrl, feedback);
          return;
        }
        if (isGitLabUrl(url) && this.config.gitPlatform !== 'gitlab') {
          this.logger.info('URL appears to be GitLab, using GitLab adapter for commenting.');
          // Create a GitLab adapter specifically for this request
          const gitFactory = new GitAdapterFactory();
          const tempConfig = { ...this.config, gitPlatform: 'gitlab' as const };
          const gitlabAdapter = gitFactory.create(tempConfig);

          const parsedUrl = gitlabAdapter.parseRequestUrl(this.config.gitMrUrl);
          await gitlabAdapter.commentOnRequest(parsedUrl, feedback);
          return;
        }

        // Use the default adapter if no special case was detected
        const parsedUrl = this.gitAdapter.parseRequestUrl(this.config.gitMrUrl);
        await this.gitAdapter.commentOnRequest(parsedUrl, feedback);
      } else if (
        this.config.mrMode === 'ci' &&
        process.env['CI_PIPELINE_SOURCE'] === 'merge_request_event'
      ) {
        // Post comment in CI mode
        if (this.config.gitPlatform === 'gitlab') {
          await this.gitAdapter.commentOnRequest(
            {
              projectId: this.config.projectId || '',
              mergeRequestIid: this.config.mergeRequestIid || '',
            },
            feedback
          );
        } else if (this.config.gitPlatform === 'github') {
          // Handle GitHub CI mode
          throw new Error('GitHub CI mode not fully implemented yet');
        }
      } else {
        // Local mode - just print the feedback
        this.logger.info('Running in local mode, skipping comment creation');
        this.logger.user('\n===== LLM REVIEW ======\n');
        this.logger.user(feedback);
        this.logger.user('\n=======================\n');
      }
    } catch (error) {
      this.logger.error('Error posting comment:', error as Error);
      throw error;
    }
  }

  /**
   * Get the LLM model name based on the provider
   */
  private getLLMModelName(): string {
    switch (this.config.llmProvider) {
      case 'anthropic':
        return this.config.anthropicModel;
      case 'openai':
        return this.config.openaiModel;
      case 'deepseek':
        return this.config.deepseekModel;
      case 'copilot':
        return this.config.copilotModel;
      default:
        return 'unknown';
    }
  }

  /**
   * Execute the review workflow
   * @returns Path to the saved review file
   */
  async review(): Promise<string | null> {
    try {
      // Get the diff
      const diff = await this.getDiff();
      this.logger.info(`Retrieved diff (${diff.length} characters)`);

      if (diff.length === 0) {
        this.logger.warn('No changes detected, skipping LLM analysis');
        return null;
      }

      // If showDiff is enabled, display the diff
      if (this.config.showDiff) {
        this.logger.user('\n===== DIFF START =====\n');
        this.logger.user(diff);
        this.logger.user('\n===== DIFF END =====\n');

        // If we're in interactive mode, ask for confirmation
        if (process.stdin.isTTY) {
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });

          const answer = await new Promise<string>(resolve => {
            rl.question('Continue with LLM analysis? (Y/n): ', resolve);
          });

          rl.close();

          if (answer.toLowerCase() === 'n') {
            this.logger.info('LLM analysis cancelled by user');
            return null;
          }
        }
      }

      // Analyze the diff with LLM
      const feedback = await this.analyzeDiff(diff);
      this.logger.info('LLM analysis completed');

      // Save the review to a file with metadata
      const metadata = {
        timestamp: new Date().toISOString(),
        llmProvider: this.config.llmProvider,
        llmModel: this.getLLMModelName(),
        mrMode: this.config.mrMode,
        gitPlatform: this.config.gitPlatform,
        commandLine: process.argv.join(' '),
      };

      const reviewFilePath = this.fileUtils.saveReviewToFile(
        this.config.reviewsDir,
        feedback,
        metadata
      );

      // Parse the feedback to an object for formatting
      let parsedFeedback: any;
      try {
        parsedFeedback = typeof feedback === 'string' ? JSON.parse(feedback) : feedback;

        // Ensure we have the required properties for the feedback
        if (!parsedFeedback.overview) {
          parsedFeedback.overview = '';
        }
        if (!parsedFeedback.fileReviews) {
          parsedFeedback.fileReviews = [];
        }
        if (!parsedFeedback.testReview) {
          parsedFeedback.testReview = '';
        }
        if (!parsedFeedback.generalFeedback) {
          parsedFeedback.generalFeedback = '';
        }
      } catch (error) {
        this.logger.error('Error parsing feedback for formatting:', error as Error);
        throw new Error('Could not format review due to JSON parsing error');
      }

      // Format the feedback using the template
      const formattedComment = this.formatter.format({
        metadata,
        feedback: parsedFeedback,
      });

      // Post the comment
      await this.postComment(formattedComment);

      this.logger.info('Review completed successfully');
      return reviewFilePath;
    } catch (error) {
      this.logger.error('Review failed:', error as Error);
      throw error;
    }
  }
}
