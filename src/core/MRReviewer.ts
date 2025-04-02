import readline from 'node:readline';

import { GitAdapterFactory } from '../adapters/git';
import type { GitAdapter } from '../adapters/git/GitAdapter';
import { LLMAdapterFactory } from '../adapters/llm';
import type { LLMAdapter } from '../adapters/llm/LLMAdapter';
import type { AppConfig } from '../config/config';
import { FileUtils } from '../utils/fileUtils';
import { Logger } from '../utils/logging';
import { ReviewFormatter } from './ReviewFormatter';
import type { FileReview, Overview, ReviewFeedback } from './ReviewFormatter';

interface ReviewMetadata {
  timestamp: string;
  llmProvider: string;
  llmModel: string;
  mrMode: string;
  gitPlatform: string;
  commandLine: string;
  [key: string]: string;
}

interface ParsedFeedback extends ReviewFeedback {
  [key: string]: any;
}

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
   * Execute the review workflow
   * @returns Path to the saved review file
   */
  async review(): Promise<string | null> {
    try {
      // Get the diff
      const diff = await this.getDiff();
      if (this.config.verbose) {
        this.logger.debug(`</diff start>${diff}</diff end>`);
      }
      this.logger.info(`Retrieved diff (${diff.length} characters)`);

      if (diff.length === 0) {
        this.logger.warn('No changes detected, skipping LLM analysis');
        return null;
      }

      if (await this.shouldCancelReview(diff)) {
        return null;
      }

      const feedback = await this.analyzeDiff(diff);
      this.logger.info('LLM analysis completed');

      const metadata = this.createReviewMetadata();

      const reviewFilePath = this.fileUtils.saveReviewToFile(
        this.config.reviewsDir,
        feedback,
        metadata
      );

      const parsedFeedback = this.parseFeedback(feedback);
      const formattedComment = this.formatter.format({
        metadata,
        feedback: parsedFeedback,
      });

      await this.postComment(formattedComment);

      this.logger.info('Review completed successfully');
      return reviewFilePath;
    } catch (error) {
      this.logger.error('Review failed:', error as Error);
      throw error;
    }
  }

  /**
   * Create metadata for the review
   *
   * @returns Review metadata object
   */
  private createReviewMetadata(): ReviewMetadata {
    return {
      timestamp: new Date().toISOString(),
      llmProvider: this.config.llmProvider,
      llmModel: this.getLLMModelName(),
      mrMode: this.config.mrMode,
      gitPlatform: this.config.gitPlatform,
      commandLine: process.argv.join(' '),
    };
  }

  /**
   * Check if the review should be canceled based on user input
   *
   * @param diff The diff content
   * @returns True if the review should be canceled
   */
  private async shouldCancelReview(diff: string): Promise<boolean> {
    if (!this.config.showDiff) {
      return false;
    }

    this.displayDiff(diff);

    // If we're not in interactive mode, continue with the review
    if (!process.stdin.isTTY) {
      return false;
    }

    const shouldCancel = await this.promptForCancellation();
    if (shouldCancel) {
      this.logger.info('LLM analysis cancelled by user');
      return true;
    }

    return false;
  }

  /**
   * Display the diff to the user
   *
   * @param diff The diff content
   */
  private displayDiff(diff: string): void {
    this.logger.user('\n===== DIFF START =====\n');
    this.logger.user(diff);
    this.logger.user('\n===== DIFF END =====\n');
  }

  /**
   * Prompt the user for cancellation
   *
   * @returns True if the user wants to cancel
   */
  private async promptForCancellation(): Promise<boolean> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>(resolve => {
      rl.question('Continue with LLM analysis? (Y/n): ', resolve);
    });

    rl.close();
    return answer.toLowerCase() === 'n';
  }

  /**
   * Parse the feedback string into a structured object
   *
   * @param feedback The feedback string from the LLM
   * @returns Parsed feedback object
   */
  private parseFeedback(feedback: string): ParsedFeedback {
    try {
      const parsedFeedback: any = typeof feedback === 'string' ? JSON.parse(feedback) : feedback;

      // TODO(FIXME)
      // Create a new object with default values and spread the parsed feedback
      // This avoids the "specified more than once" TypeScript warning
      const result: ParsedFeedback = {
        // Default values
        overview: parsedFeedback.overview || ({} as Overview),
        fileReviews: parsedFeedback.fileReviews || ([] as FileReview[]),
        testReview: parsedFeedback.testReview || '',
        generalFeedback: parsedFeedback.generalFeedback || '',

        // Copy any other properties
        ...Object.fromEntries(
          Object.entries(parsedFeedback).filter(
            ([key]) => !['overview', 'fileReviews', 'testReview', 'generalFeedback'].includes(key)
          )
        ),
      };

      return result;
    } catch (error) {
      this.logger.error('Error parsing feedback for formatting:', error as Error);
      throw new Error('Could not format review due to JSON parsing error');
    }
  }

  /**
   * Get MR/PR diff based on the configured mode
   * @returns The diff content
   */
  async getDiff(): Promise<string> {
    try {
      if (this.isRunningInCI()) {
        return await this.getCIDiff();
      }

      if (this.config.mrMode === 'url') {
        return await this.getURLDiff();
      }

      // Default to local mode
      this.logger.info('Running in local mode, fetching diff from local git');
      return await this.gitAdapter.getLocalDiff();
    } catch (error) {
      this.logger.error('Error getting MR/PR diff:', error as Error);
      throw error;
    }
  }

  /**
   * Check if running in CI mode
   *
   * @returns True if running in CI mode
   */
  private isRunningInCI(): boolean {
    return (
      this.config.mrMode === 'ci' && process.env['CI_PIPELINE_SOURCE'] === 'merge_request_event'
    );
  }

  /**
   * Get diff for CI mode
   *
   * @returns The diff content
   */
  private async getCIDiff(): Promise<string> {
    this.logger.info('Running in CI mode, fetching diff from Git platform API');

    if (this.config.gitPlatform === 'gitlab') {
      return await this.gitAdapter.getRequestDiff({
        projectId: this.config.projectId || '',
        mergeRequestIid: this.config.mergeRequestIid || '',
      });
    }

    if (this.config.gitPlatform === 'github') {
      throw new Error('GitHub CI mode not fully implemented yet');
    }

    throw new Error('Unsupported Git platform for CI mode');
  }

  /**
   * Get diff for URL mode
   *
   * @returns The diff content
   */
  private async getURLDiff(): Promise<string> {
    if (!this.config.gitMrUrl) {
      throw new Error('Git MR/PR URL is required for URL mode');
    }

    const url = this.config.gitMrUrl.toLowerCase();
    const actualPlatform = this.config.gitPlatform;

    if (this.isGitHubUrl(url)) {
      console.log('isGitHub OK');
      process.exit(1);
      return await this.getGitHubDiffWithTempAdapter();
    }

    if (this.isGitLabUrl(url)) {
      console.log('isGitLabUrl OK');
      return await this.getGitLabDiffWithTempAdapter();
    }
    console.log('how?');
    process.exit(1);
    this.logger.info(`Running in URL mode, fetching diff from ${actualPlatform} API using URL`);

    // Use the default adapter
    const parsedUrl = this.gitAdapter.parseRequestUrl(this.config.gitMrUrl ?? '');
    return await this.gitAdapter.getRequestDiff(parsedUrl);
  }

  /**
   * Get GitHub diff using a temporary adapter
   *
   * @returns The diff content
   */
  private async getGitHubDiffWithTempAdapter(): Promise<string> {
    this.logger.info(
      'URL appears to be GitHub, but platform is set to GitLab. Switching to GitHub adapter.'
    );

    if (!this.config.gitMrUrl) {
      throw new Error('Git MR/PR URL is required for GitHub adapter');
    }

    const gitFactory = new GitAdapterFactory();
    const tempConfig = { ...this.config, gitPlatform: 'github' as const };
    const githubAdapter = gitFactory.create(tempConfig);

    const parsedUrl = githubAdapter.parseRequestUrl(this.config.gitMrUrl);
    return await githubAdapter.getRequestDiff(parsedUrl);
  }

  /**
   * Get GitLab diff using a temporary adapter
   *
   * @returns The diff content
   */
  private async getGitLabDiffWithTempAdapter(): Promise<string> {
    this.logger.info(
      'URL appears to be GitLab, but platform is set to GitHub. Switching to GitLab adapter.'
    );

    if (!this.config.gitMrUrl) {
      throw new Error('Git MR/PR URL is required for GitLab adapter');
    }

    const gitFactory = new GitAdapterFactory();
    const tempConfig = { ...this.config, gitPlatform: 'gitlab' as const };
    const gitlabAdapter = gitFactory.create(tempConfig);
    const parsedUrl = gitlabAdapter.parseRequestUrl(this.config.gitMrUrl);
    const diffResult = await gitlabAdapter.getRequestDiff(parsedUrl);
    if (this.config.verbose) {
      this.logger.debug(`</diff start>${diffResult}</diff end>`);
    }
    return diffResult;
  }

  /**
   * Check if URL is a GitHub URL
   *
   * @param url URL to check
   * @returns True if URL is a GitHub URL
   */
  private isGitHubUrl(url: string): boolean {
    return url.includes('github.com') || url.includes('/pull/');
  }

  /**
   * Check if URL is a GitLab URL
   *
   * @param url URL to check
   * @returns True if URL is a GitLab URL
   */
  private isGitLabUrl(url: string): boolean {
    return (
      url.includes('gitlab') ||
      url.includes('-/merge_requests/') ||
      url.includes('/merge_requests/')
    );
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
        await this.postCommentForUrlMode(feedback);
        return;
      }

      if (this.isRunningInCI()) {
        await this.postCommentForCIMode(feedback);
        return;
      }

      // Default to local mode - just print the feedback
      this.displayLocalModeComment(feedback);
    } catch (error) {
      this.logger.error('Error posting comment:', error as Error);
      throw error;
    }
  }

  /**
   * Post comment for URL mode
   *
   * @param feedback The formatted feedback
   */
  private async postCommentForUrlMode(feedback: string): Promise<void> {
    if (!this.config.gitMrUrl) {
      throw new Error('Git MR/PR URL is required for URL mode');
    }

    const url = this.config.gitMrUrl.toLowerCase();

    if (this.isGitHubUrl(url) && this.config.gitPlatform !== 'github') {
      await this.postCommentWithGitHubAdapter(feedback);
      return;
    }

    if (this.isGitLabUrl(url) && this.config.gitPlatform !== 'gitlab') {
      await this.postCommentWithGitLabAdapter(feedback);
      return;
    }

    // Use the default adapter
    const parsedUrl = this.gitAdapter.parseRequestUrl(this.config.gitMrUrl);
    await this.gitAdapter.commentOnRequest(parsedUrl, feedback);
  }

  /**
   * Post comment using GitHub adapter
   *
   * @param feedback The formatted feedback
   */
  private async postCommentWithGitHubAdapter(feedback: string): Promise<void> {
    this.logger.info('URL appears to be GitHub, using GitHub adapter for commenting.');

    if (!this.config.gitMrUrl) {
      throw new Error('Git MR/PR URL is required for GitHub comment');
    }

    const gitFactory = new GitAdapterFactory();
    const tempConfig = { ...this.config, gitPlatform: 'github' as const };
    const githubAdapter = gitFactory.create(tempConfig);

    const parsedUrl = githubAdapter.parseRequestUrl(this.config.gitMrUrl);
    await githubAdapter.commentOnRequest(parsedUrl, feedback);
  }

  /**
   * Post comment using GitLab adapter
   *
   * @param feedback The formatted feedback
   */
  private async postCommentWithGitLabAdapter(feedback: string): Promise<void> {
    this.logger.info('URL appears to be GitLab, using GitLab adapter for commenting.');

    if (!this.config.gitMrUrl) {
      throw new Error('Git MR/PR URL is required for GitLab comment');
    }

    const gitFactory = new GitAdapterFactory();
    const tempConfig = { ...this.config, gitPlatform: 'gitlab' as const };
    const gitlabAdapter = gitFactory.create(tempConfig);

    const parsedUrl = gitlabAdapter.parseRequestUrl(this.config.gitMrUrl);
    await gitlabAdapter.commentOnRequest(parsedUrl, feedback);
  }

  /**
   * Post comment for CI mode
   *
   * @param feedback The formatted feedback
   */
  private async postCommentForCIMode(feedback: string): Promise<void> {
    if (this.config.gitPlatform === 'gitlab') {
      await this.gitAdapter.commentOnRequest(
        {
          projectId: this.config.projectId || '',
          mergeRequestIid: this.config.mergeRequestIid || '',
        },
        feedback
      );
    } else if (this.config.gitPlatform === 'github') {
      throw new Error('GitHub CI mode not fully implemented yet');
    }
  }

  /**
   * Display comment for local mode
   *
   * @param feedback The formatted feedback
   */
  private displayLocalModeComment(feedback: string): void {
    this.logger.info('Running in local mode, skipping comment creation');
    this.logger.user('\n===== LLM REVIEW ======\n');
    this.logger.user(feedback);
    this.logger.user('\n=======================\n');
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
}
