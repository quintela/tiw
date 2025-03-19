import path from 'node:path';

import dotenv from 'dotenv';

import { GitDetector } from '../utils/gitDetector';
import { Logger } from '../utils/logging';

// Load environment variables
dotenv.config();

export type LLMProvider = 'anthropic' | 'openai' | 'deepseek' | 'copilot';
export type GitPlatform = 'gitlab' | 'github';
export type MRMode = 'ci' | 'local' | 'url';

export interface ConfigOptions {
  llmProvider?: LLMProvider | undefined;
  model?: string | undefined;
  gitPlatform?: GitPlatform | undefined;
  promptDir?: string | undefined;
  formatterTemplate?: string | undefined;
  mrMode?: MRMode | undefined;
  gitMrUrl?: string | null | undefined;
  showDiff?: boolean | undefined;
  reviewsDir?: string | undefined;
  verbose?: boolean | undefined;
  maxPromptTokens?: number | undefined;
  [key: string]: unknown;
}

export interface RequiredVar {
  key: string;
  name: string;
}

export interface AppConfig {
  llmProvider: LLMProvider;
  anthropicModel: string;
  openaiModel: string;
  deepseekModel: string;
  copilotModel: string;
  anthropicApiKey: string | undefined;
  openaiApiKey: string | undefined;
  deepseekApiKey: string | undefined;
  copilotApiKey: string | undefined;
  gitPlatform: GitPlatform;
  gitlabUrl: string;
  gitlabToken: string | undefined;
  githubToken: string | undefined;
  projectId: string | undefined;
  mergeRequestIid: string | undefined;
  mrMode: MRMode;
  gitMrUrl: string | null;
  showDiff: boolean;
  reviewsDir: string;
  promptDir: string;
  formatterTemplate: string;
  verbose: boolean;
  maxPromptTokens: number;
  anthropicMaxTokens: number;
  openaiMaxTokens: number;
  deepseekMaxTokens: number;
  copilotMaxTokens: number;
  ignoreLockFiles: boolean;
  [key: string]: unknown;
}

/**
 * Configuration manager for the MR reviewer
 * Handles loading configs from environment variables, files, and CLI args
 */
export class Config {
  private options: ConfigOptions;
  private defaults: AppConfig;
  private logger: Logger;
  private gitDetector: GitDetector;
  public config!: AppConfig;

  /**
   * Singleton instance of Config
   */
  private static instance: Config;

  /**
   * Get singleton instance of Config
   * @param options - Configuration options from CLI or calling code
   * @returns The Config instance
   */
  public static getInstance(options: ConfigOptions = {}): Config {
    if (!Config.instance) {
      Config.instance = new Config(options);
    }
    return Config.instance;
  }

  /**
   * Create a new configuration instance
   * @param options - Configuration options from CLI or calling code
   */
  constructor(options: ConfigOptions = {}) {
    this.logger = new Logger();
    this.gitDetector = new GitDetector(this.logger);
    this.options = options;
    this.defaults = {
      // LLM provider configuration
      llmProvider: (process.env['LLM_PROVIDER'] as LLMProvider) || 'anthropic',
      anthropicModel: process.env['ANTHROPIC_MODEL'] || 'claude-3-7-sonnet-20250219',
      openaiModel: process.env['OPENAI_MODEL'] || 'gpt-4',
      deepseekModel: process.env['DEEPSEEK_MODEL'] || 'deepseek-coder',
      copilotModel: process.env['COPILOT_MODEL'] || 'gpt-4',
      anthropicApiKey: process.env['ANTHROPIC_API_KEY'],
      openaiApiKey: process.env['OPENAI_API_KEY'],
      deepseekApiKey: process.env['DEEPSEEK_API_KEY'],
      copilotApiKey: process.env['COPILOT_API_KEY'],

      // Token limits for each provider
      maxPromptTokens: parseInt(process.env['MAX_PROMPT_TOKENS'] || '100000', 10),
      anthropicMaxTokens: parseInt(process.env['ANTHROPIC_MAX_TOKENS'] || '190000', 10),
      openaiMaxTokens: parseInt(process.env['OPENAI_MAX_TOKENS'] || '128000', 10),
      deepseekMaxTokens: parseInt(process.env['DEEPSEEK_MAX_TOKENS'] || '128000', 10),
      copilotMaxTokens: parseInt(process.env['COPILOT_MAX_TOKENS'] || '128000', 10),

      // Git platform configuration - will be auto-detected if not specified
      gitPlatform: (process.env['GIT_PLATFORM'] as GitPlatform) || 'gitlab',
      gitlabUrl: process.env['GITLAB_URL'] || 'https://gitlab.com',
      gitlabToken: process.env['GITLAB_TOKEN'],
      githubToken: process.env['GITHUB_TOKEN'],

      // MR/PR identifiers
      projectId: process.env['CI_PROJECT_ID'],
      mergeRequestIid: process.env['CI_MERGE_REQUEST_IID'],

      // Mode: 'ci', 'local', or 'url'
      mrMode: 'local',

      // Git repository URL if using URL mode
      gitMrUrl: null,

      // UI/Output options
      showDiff: false,
      verbose: process.env['VERBOSE'] === 'true' || false,

      // By default, ignore lock files in diff generation
      ignoreLockFiles: process.env['IGNORE_LOCK_FILES'] !== 'false',

      // Path to reviews output directory
      reviewsDir: path.join(process.cwd(), 'reviews'),

      // Default templates
      promptDir: path.join(__dirname, '..', 'templates', 'prompts'),
      formatterTemplate: path.join(
        __dirname,
        '..',
        'templates',
        'formatters',
        'markdown_format.md'
      ),
    };
  }

  /**
   * Load and validate configuration
   * @returns The complete configuration
   */
  async load(): Promise<AppConfig> {
    // Auto-detect git platform if not specified in options or env
    if (!this.options.gitPlatform && !process.env['GIT_PLATFORM']) {
      await this.autoDetectGitPlatform();
    }

    // Merge defaults with options
    const mergedConfig = {
      ...this.defaults,
      ...this.options,
    };

    // Ensure required properties are set to their default values if not provided
    this.config = {
      llmProvider: mergedConfig.llmProvider || 'anthropic',
      anthropicModel: mergedConfig.anthropicModel || 'claude-3-7-sonnet-20250219',
      openaiModel: mergedConfig.openaiModel || 'gpt-4',
      deepseekModel: mergedConfig.deepseekModel || 'deepseek-coder',
      copilotModel: mergedConfig.copilotModel || 'gpt-4',
      anthropicApiKey: mergedConfig.anthropicApiKey,
      openaiApiKey: mergedConfig.openaiApiKey,
      deepseekApiKey: mergedConfig.deepseekApiKey,
      copilotApiKey: mergedConfig.copilotApiKey,

      // Token limits
      maxPromptTokens: mergedConfig.maxPromptTokens || 100000,
      anthropicMaxTokens: mergedConfig.anthropicMaxTokens || 190000,
      openaiMaxTokens: mergedConfig.openaiMaxTokens || 128000,
      deepseekMaxTokens: mergedConfig.deepseekMaxTokens || 128000,
      copilotMaxTokens: mergedConfig.copilotMaxTokens || 128000,

      gitPlatform: mergedConfig.gitPlatform || 'gitlab',
      gitlabUrl: mergedConfig.gitlabUrl || 'https://gitlab.com',
      gitlabToken: mergedConfig.gitlabToken,
      githubToken: mergedConfig.githubToken,
      projectId: mergedConfig.projectId,
      mergeRequestIid: mergedConfig.mergeRequestIid,
      mrMode: mergedConfig.mrMode || 'local',
      gitMrUrl: mergedConfig.gitMrUrl || null,
      showDiff: !!mergedConfig.showDiff,
      verbose: !!mergedConfig.verbose,
      ignoreLockFiles: mergedConfig.ignoreLockFiles !== false,
      reviewsDir: mergedConfig.reviewsDir || path.join(process.cwd(), 'reviews'),
      promptDir: mergedConfig.promptDir || path.join(__dirname, '..', 'templates', 'prompts'),
      formatterTemplate:
        mergedConfig.formatterTemplate ||
        path.join(__dirname, '..', 'templates', 'formatters', 'markdown_format.md'),
    };

    return this.config;
  }

  /**
   * Validate the configuration based on the selected mode
   * @throws {Error} If required configuration is missing
   */
  validate(): void {
    // Build the list of required variables based on configuration
    const requiredVars: RequiredVar[] = [];

    // Check LLM API keys
    switch (this.config.llmProvider) {
      case 'anthropic':
        requiredVars.push({ key: 'anthropicApiKey', name: 'Anthropic API Key' });
        break;
      case 'openai':
        requiredVars.push({ key: 'openaiApiKey', name: 'OpenAI API Key' });
        break;
      case 'deepseek':
        requiredVars.push({ key: 'deepseekApiKey', name: 'DeepSeek API Key' });
        break;
      case 'copilot':
        requiredVars.push({ key: 'copilotApiKey', name: 'Copilot API Key' });
        break;
      default:
        throw new Error(`Unsupported LLM provider: ${this.config.llmProvider}`);
    }

    // Check Git platform and MR mode requirements
    if (
      this.config.mrMode === 'ci' &&
      process.env['CI_PIPELINE_SOURCE'] === 'merge_request_event'
    ) {
      if (this.config.gitPlatform === 'gitlab') {
        requiredVars.push(
          { key: 'gitlabToken', name: 'GitLab Token' },
          { key: 'projectId', name: 'CI_PROJECT_ID' },
          { key: 'mergeRequestIid', name: 'CI_MERGE_REQUEST_IID' }
        );
      } else if (this.config.gitPlatform === 'github') {
        requiredVars.push(
          { key: 'githubToken', name: 'GitHub Token' }
          // Add GitHub-specific fields
        );
      } else {
        throw new Error(`Unsupported Git platform: ${this.config.gitPlatform}`);
      }
    } else if (this.config.mrMode === 'url') {
      if (this.config.gitPlatform === 'gitlab') {
        requiredVars.push(
          { key: 'gitlabToken', name: 'GitLab Token' },
          { key: 'gitMrUrl', name: 'Git MR/PR URL' }
        );
      } else if (this.config.gitPlatform === 'github') {
        requiredVars.push(
          { key: 'githubToken', name: 'GitHub Token' },
          { key: 'gitMrUrl', name: 'Git MR/PR URL' }
        );
      } else {
        throw new Error(`Unsupported Git platform: ${this.config.gitPlatform}`);
      }
    }

    // Check for missing required variables
    for (const { key, name } of requiredVars) {
      if (!this.config[key]) {
        throw new Error(`${name} is required but not set`);
      }
    }
  }

  /**
   * Auto-detect Git platform from repository
   */
  private async autoDetectGitPlatform(): Promise<void> {
    const platformInfo = await this.gitDetector.detectGitPlatform();

    if (!platformInfo) {
      this.logger.warn('Could not auto-detect Git platform, using default');
      return;
    }

    this.logger.info(`Auto-detected Git platform: ${platformInfo.platform}`);

    if (platformInfo.platform === 'github') {
      this.defaults.gitPlatform = 'github';
      // Set GitHub-specific defaults
      if (platformInfo.owner && platformInfo.repo) {
        this.logger.debug(`GitHub repository: ${platformInfo.owner}/${platformInfo.repo}`);
      }
    } else if (platformInfo.platform === 'gitlab') {
      this.defaults.gitPlatform = 'gitlab';
      if (platformInfo.url) {
        this.defaults.gitlabUrl = platformInfo.url;
        this.logger.debug(`GitLab URL: ${platformInfo.url}`);
      }
      if (platformInfo.projectPath) {
        this.logger.debug(`GitLab project path: ${platformInfo.projectPath}`);
      }
    }
  }
}
