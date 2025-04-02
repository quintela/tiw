import path from 'node:path';

import dotenv from 'dotenv';
import _ from 'lodash';

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
    this.defaults = this.createDefaultConfig();
  }

  /**
   * Create default configuration from environment variables
   *
   * @returns Default configuration
   */
  private createDefaultConfig(): AppConfig {
    return {
      // LLM provider configuration
      llmProvider: (this.getEnvVar('LLM_PROVIDER') as LLMProvider) || 'anthropic',
      anthropicModel: this.getEnvVar('ANTHROPIC_MODEL') || 'claude-3-7-sonnet-20250219',
      openaiModel: this.getEnvVar('OPENAI_MODEL') || 'gpt-4',
      deepseekModel: this.getEnvVar('DEEPSEEK_MODEL') || 'deepseek-coder',
      copilotModel: this.getEnvVar('COPILOT_MODEL') || 'gpt-4',
      anthropicApiKey: this.getEnvVar('ANTHROPIC_API_KEY'),
      openaiApiKey: this.getEnvVar('OPENAI_API_KEY'),
      deepseekApiKey: this.getEnvVar('DEEPSEEK_API_KEY'),
      copilotApiKey: this.getEnvVar('COPILOT_API_KEY'),

      // Token limits for each provider
      maxPromptTokens: this.getEnvVarAsInt('MAX_PROMPT_TOKENS', 100000),
      anthropicMaxTokens: this.getEnvVarAsInt('ANTHROPIC_MAX_TOKENS', 190000),
      openaiMaxTokens: this.getEnvVarAsInt('OPENAI_MAX_TOKENS', 128000),
      deepseekMaxTokens: this.getEnvVarAsInt('DEEPSEEK_MAX_TOKENS', 128000),
      copilotMaxTokens: this.getEnvVarAsInt('COPILOT_MAX_TOKENS', 128000),

      // Git platform configuration - will be auto-detected if not specified
      gitPlatform: (this.getEnvVar('GIT_PLATFORM') as GitPlatform) || 'gitlab',
      gitlabUrl: this.getEnvVar('GITLAB_URL') || 'https://gitlab.com',
      gitlabToken: this.getEnvVar('GITLAB_TOKEN'),
      githubToken: this.getEnvVar('GITHUB_TOKEN'),

      // MR/PR identifiers
      projectId: this.getEnvVar('CI_PROJECT_ID'),
      mergeRequestIid: this.getEnvVar('CI_MERGE_REQUEST_IID'),

      // Mode: 'ci', 'local', or 'url'
      mrMode: 'local',

      // Git repository URL if using URL mode
      gitMrUrl: null,

      // UI/Output options
      showDiff: false,
      verbose: this.getEnvVar('VERBOSE') === 'true' || false,

      // By default, ignore lock files in diff generation
      ignoreLockFiles: this.getEnvVar('IGNORE_LOCK_FILES') !== 'false',

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
   * Get environment variable value
   *
   * @param name Environment variable name
   * @returns Environment variable value or undefined
   */
  private getEnvVar(name: string): string | undefined {
    return process.env[name];
  }

  /**
   * Get environment variable as integer
   *
   * @param name Environment variable name
   * @param defaultValue Default value if not found or not a valid number
   * @returns Environment variable as integer or default value
   */
  private getEnvVarAsInt(name: string, defaultValue: number): number {
    const value = this.getEnvVar(name);
    if (!value) {
      return defaultValue;
    }

    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Merge environment variables and command line options
   * Environment variables take precedence
   *
   * @param config Base configuration
   * @param options Command line options
   * @returns Merged configuration
   */
  private mergeWithEnvAndOptions(config: AppConfig, options: ConfigOptions): AppConfig {
    // First merge with options
    const withOptions = _.merge({}, config, options);

    // Define default token limits
    const DEFAULT_TOKENS = {
      maxPrompt: 100000,
      anthropic: 190000,
      openai: 128000,
      deepseek: 128000,
      copilot: 128000,
    };

    // Then override with environment variables if they exist
    return {
      ...withOptions,
      // LLM provider configuration
      llmProvider: (this.getEnvVar('LLM_PROVIDER') as LLMProvider) || withOptions.llmProvider,
      anthropicModel: this.getEnvVar('ANTHROPIC_MODEL') || withOptions.anthropicModel,
      openaiModel: this.getEnvVar('OPENAI_MODEL') || withOptions.openaiModel,
      deepseekModel: this.getEnvVar('DEEPSEEK_MODEL') || withOptions.deepseekModel,
      copilotModel: this.getEnvVar('COPILOT_MODEL') || withOptions.copilotModel,
      anthropicApiKey: this.getEnvVar('ANTHROPIC_API_KEY') || withOptions.anthropicApiKey,
      openaiApiKey: this.getEnvVar('OPENAI_API_KEY') || withOptions.openaiApiKey,
      deepseekApiKey: this.getEnvVar('DEEPSEEK_API_KEY') || withOptions.deepseekApiKey,
      copilotApiKey: this.getEnvVar('COPILOT_API_KEY') || withOptions.copilotApiKey,

      // Token limits with proper defaults
      maxPromptTokens: this.getEnvVarAsInt(
        'MAX_PROMPT_TOKENS',
        _.isNumber(withOptions.maxPromptTokens)
          ? withOptions.maxPromptTokens
          : DEFAULT_TOKENS.maxPrompt
      ),
      anthropicMaxTokens: this.getEnvVarAsInt(
        'ANTHROPIC_MAX_TOKENS',
        _.isNumber(withOptions.anthropicMaxTokens)
          ? withOptions.anthropicMaxTokens
          : DEFAULT_TOKENS.anthropic
      ),
      openaiMaxTokens: this.getEnvVarAsInt(
        'OPENAI_MAX_TOKENS',
        _.isNumber(withOptions.openaiMaxTokens)
          ? withOptions.openaiMaxTokens
          : DEFAULT_TOKENS.openai
      ),
      deepseekMaxTokens: this.getEnvVarAsInt(
        'DEEPSEEK_MAX_TOKENS',
        _.isNumber(withOptions.deepseekMaxTokens)
          ? withOptions.deepseekMaxTokens
          : DEFAULT_TOKENS.deepseek
      ),
      copilotMaxTokens: this.getEnvVarAsInt(
        'COPILOT_MAX_TOKENS',
        _.isNumber(withOptions.copilotMaxTokens)
          ? withOptions.copilotMaxTokens
          : DEFAULT_TOKENS.copilot
      ),

      // TODO(FIXME) remove. Git platform configuration
      gitPlatform: (this.getEnvVar('GIT_PLATFORM') as GitPlatform) || withOptions.gitPlatform,
      gitlabUrl: this.getEnvVar('GITLAB_URL') || withOptions.gitlabUrl,
      // TODO(FIXME) remove. MR/PR identifiers
      projectId: this.getEnvVar('CI_PROJECT_ID') || withOptions.projectId,
      mergeRequestIid: this.getEnvVar('CI_MERGE_REQUEST_IID') || withOptions.mergeRequestIid,

      // tokens
      gitlabToken: this.getEnvVar('GITLAB_TOKEN') || withOptions.gitlabToken,
      githubToken: this.getEnvVar('GITHUB_TOKEN') || withOptions.githubToken,

      // UI/Output options - fix the verbose flag to be a boolean
      verbose: this.getEnvVar('VERBOSE') === 'true' || !!withOptions.verbose,
      ignoreLockFiles: this.getEnvVar('IGNORE_LOCK_FILES') !== 'false',
    };
  }

  /**
   * Map model option to specific provider model property
   *
   * @param config Current configuration
   * @returns Updated configuration with model mapped to provider-specific property
   */
  private mapModelToProvider(config: AppConfig): AppConfig {
    // Check if model was specified by the user and map it to the right provider's model
    if (this.options.model) {
      switch (config.llmProvider) {
        case 'anthropic':
          config.anthropicModel = this.options.model;
          break;
        case 'openai':
          config.openaiModel = this.options.model;
          break;
        case 'deepseek':
          config.deepseekModel = this.options.model;
          break;
        case 'copilot':
          config.copilotModel = this.options.model;
          break;
      }
    }

    return config;
  }

  /**
   * Resolve paths for templates and reviews directory
   *
   * @param config Current configuration
   * @returns Updated configuration with resolved paths
   */
  private resolveTemplatePaths(config: AppConfig): AppConfig {
    const updatedConfig = { ...config };

    if (this.options['templates'] && !this.options.formatterTemplate) {
      const templatesDir = this.options['templates'] as string;
      updatedConfig.formatterTemplate = path.join(templatesDir, 'formatter.txt');
      updatedConfig.promptDir = templatesDir;
    }

    return updatedConfig;
  }

  /**
   * Load and validate configuration
   * @returns The complete configuration
   */
  async load(): Promise<AppConfig> {
    // Auto-detect git platform if not specified in options or env
    if (!this.options.gitPlatform && !this.getEnvVar('GIT_PLATFORM')) {
      await this.autoDetectGitPlatform();
    }

    // Merge defaults with options and environment variables
    // Environment variables take precedence
    let mergedConfig = this.mergeWithEnvAndOptions(this.defaults, this.options);

    // Map model to provider-specific model property
    mergedConfig = this.mapModelToProvider(mergedConfig);

    // Resolve paths for templates
    mergedConfig = this.resolveTemplatePaths(mergedConfig);

    this.config = mergedConfig;
    return this.config;
  }

  /**
   * Get required variables for specific LLM provider
   *
   * @param provider LLM provider
   * @returns List of required variables
   */
  private getLLMRequiredVars(provider: LLMProvider): RequiredVar[] {
    switch (provider) {
      case 'anthropic':
        return [{ key: 'anthropicApiKey', name: 'Anthropic API Key' }];
      case 'openai':
        return [{ key: 'openaiApiKey', name: 'OpenAI API Key' }];
      case 'deepseek':
        return [{ key: 'deepseekApiKey', name: 'DeepSeek API Key' }];
      case 'copilot':
        return [{ key: 'copilotApiKey', name: 'Copilot API Key' }];
      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
  }

  /**
   * Get required variables for CI mode
   *
   * @param platform Git platform
   * @returns List of required variables
   */
  private getCIRequiredVars(platform: GitPlatform): RequiredVar[] {
    if (platform === 'gitlab') {
      return [
        { key: 'gitlabToken', name: 'GitLab Token' },
        { key: 'projectId', name: 'CI_PROJECT_ID' },
        { key: 'mergeRequestIid', name: 'CI_MERGE_REQUEST_IID' },
      ];
    }

    if (platform === 'github') {
      return [
        { key: 'githubToken', name: 'GitHub Token' },
        // Add GitHub-specific fields
      ];
    }

    throw new Error(`Unsupported Git platform: ${platform}`);
  }

  /**
   * Get required variables for URL mode
   *
   * @param platform Git platform
   * @returns List of required variables
   */
  private getURLRequiredVars(platform: GitPlatform): RequiredVar[] {
    if (platform === 'gitlab') {
      return [
        { key: 'gitlabToken', name: 'GitLab Token' },
        { key: 'gitMrUrl', name: 'Git MR/PR URL' },
      ];
    }

    if (platform === 'github') {
      return [
        { key: 'githubToken', name: 'GitHub Token' },
        { key: 'gitMrUrl', name: 'Git MR/PR URL' },
      ];
    }

    throw new Error(`Unsupported Git platform: ${platform}`);
  }

  /**
   * Build list of required variables based on configuration
   *
   * @returns List of required variables
   */
  private buildRequiredVarsList(): RequiredVar[] {
    // Start with LLM provider requirements
    const requiredVars = this.getLLMRequiredVars(this.config.llmProvider);

    // Add mode-specific requirements
    if (
      this.config.mrMode === 'ci' &&
      this.getEnvVar('CI_PIPELINE_SOURCE') === 'merge_request_event'
    ) {
      requiredVars.push(...this.getCIRequiredVars(this.config.gitPlatform));
    } else if (this.config.mrMode === 'url') {
      requiredVars.push(...this.getURLRequiredVars(this.config.gitPlatform));
    }

    return requiredVars;
  }

  /**
   * Check if all required variables are present
   *
   * @param requiredVars List of required variables
   * @returns List of missing variables
   */
  private findMissingVars(requiredVars: RequiredVar[]): RequiredVar[] {
    return requiredVars.filter(({ key }) => !this.config[key]);
  }

  /**
   * Validate the configuration based on the selected mode
   * @throws {Error} If required configuration is missing
   */
  validate(): void {
    const requiredVars = this.buildRequiredVarsList();
    const missingVars = this.findMissingVars(requiredVars);

    if (missingVars.length > 0) {
      const missingNames = missingVars.map(v => v.name).join(', ');
      throw new Error(`Missing required configuration: ${missingNames}`);
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

    this.updateGitPlatformDefaults(platformInfo);
  }

  /**
   * Update Git platform defaults based on detected information
   *
   * @param platformInfo Detected platform information
   */
  private updateGitPlatformDefaults(platformInfo: any): void {
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
