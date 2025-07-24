#!/usr/bin/env ts-node

/**
 * Tiw - LLM-powered code review tool
 *
 * @license Apache-2.0
 * @author Tiago <913367+quintela@users.noreply.github.com>
 * @copyright 2025 Tiago
 */
import { Command } from 'commander';
import * as fs from 'fs';
import * as _ from 'lodash';
import * as path from 'path';

import { Config, type GitPlatform, type LLMProvider, type MRMode } from './config/config';
import { MRReviewer } from './core/MRReviewer';
import { Logger } from './utils/logging';

// TODO(FIX): valid provider names
const VALID_PROVIDERS = ['anthropic'] as const;
// const VALID_PROVIDERS = ['anthropic', 'openai', 'deepseek', 'copilot'] as const;
type Provider = (typeof VALID_PROVIDERS)[number];

/**
 * Read version from package.json
 *
 * @returns Version string
 */
function getVersion(): string {
  try {
    const packageJsonPath = path.resolve(__dirname, '../package.json');
    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent);

    return packageJson.version || '0.0.0';
  } catch (error) {
    console.warn('Unable to read version from package.json:', error);
    return '0.0.0';
  }
}

/**
 * Configure logger based on CLI options
 *
 * @param options CLI options
 * @param logger Logger instance
 * @returns Updated logger
 */
function configureLogger(options: any, logger: Logger): Logger {
  if (options.debug) {
    logger.setLevel('debug');
    return logger;
  }

  if (options.verbose) {
    logger.setLevel('info');
  }

  return logger;
}

/**
 * Set up the common CLI options
 *
 * @param command Commander command to add options to
 * @returns Command with options added
 */
function addCommonOptions(command: Command): Command {
  const providersText = VALID_PROVIDERS.join(', ');

  return command
    .option('-p, --provider <provider>', `LLM provider (${providersText})`, 'anthropic')
    .option('-m, --model <model>', 'LLM model to use (default depends on provider)')
    .option(
      '--platform <platform>',
      'Git platform (gitlab or github), auto-detected if not specified'
    )
    .option('--templates <directory>', 'Directory containing all templates and prompts')
    .option('--reviews-dir <path>', 'Directory to save review files')
    .option('--verbose', 'Enable verbose logging with diff preview')
    .option('--debug', 'Enable debug mode with detailed logging');
}

/**
 * Create local mode subcommand
 *
 * @param program Commander program
 * @returns Configured local command
 */
function createLocalCommand(program: Command): Command {
  const command = program
    .command('local')
    .description('Review local git changes')
    .action(options => {
      options.mrMode = 'local';
    });

  return addCommonOptions(command);
}

/**
 * Create CI mode subcommand
 *
 * @param program Commander program
 * @returns Configured CI command
 */
function createCICommand(program: Command): Command {
  const command = program
    .command('ci')
    .description('Review changes in CI environment')
    .action(options => {
      options.mrMode = 'ci';
    });

  return addCommonOptions(command);
}

/**
 * Create URL mode subcommand
 *
 * @param program Commander program
 * @returns Configured URL command
 */
function createURLCommand(program: Command): Command {
  const command = program
    .command('url <url>')
    .description('Review a specific merge/pull request by URL')
    .action((url, options) => {
      options.mrMode = 'url';
      options.gitMrUrl = url;
    });

  return addCommonOptions(command);
}

/**
 * Initialize and configure the CLI program with subcommands
 *
 * @returns Configured Commander program
 */
function initializeProgram(): Command {
  const program = new Command();

  program
    .name('tiw')
    .description('Check merge/pull requests using LLM analysis')
    .version(getVersion());

  // Add subcommands
  createLocalCommand(program);
  createCICommand(program);
  createURLCommand(program);

  return program;
}

/**
 * Build configuration options from CLI input
 *
 * @param command Commander command with options
 * @returns Config options object
 */
function buildConfigOptions(command: Command): Record<string, any> {
  interface CliOptions {
    provider?: LLMProvider;
    model?: string;
    platform?: GitPlatform;
    templates?: string;
    mrMode?: MRMode;
    gitMrUrl?: string;
    verbose?: boolean;
    debug?: boolean;
    reviewsDir?: string;
    [key: string]: any;
  }

  const options = command.opts() as CliOptions;
  const parentOptions = command.parent ? (command.parent.opts() as CliOptions) : {};

  // Merge options from the subcommand and parent command
  const mergedOptions: CliOptions = { ...parentOptions, ...options };

  return {
    llmProvider: mergedOptions.provider as LLMProvider,
    model: mergedOptions.model,
    gitPlatform: mergedOptions.platform as GitPlatform | undefined,
    promptDir: mergedOptions.templates
      ? path.join(mergedOptions.templates, 'prompts')
      : undefined,
    formatterTemplate: mergedOptions.templates
      ? path.join(mergedOptions.templates, 'formatters', 'markdown_format.md')
      : undefined,
    mrMode: mergedOptions.mrMode as MRMode,
    gitMrUrl: mergedOptions.gitMrUrl,
    showDiff: mergedOptions.verbose || mergedOptions.debug,
    reviewsDir: mergedOptions.reviewsDir,
  };
}

/**
 * Get the appropriate LLM model name based on provider
 *
 * @param config Configuration object
 * @returns Model name string
 */
function getLlmModelName(config: any): string {
  const provider = _.toLower(config.llmProvider) as Provider;

  const providers: Record<Provider, string> = {} as Record<Provider, string>;

  VALID_PROVIDERS.forEach(providerName => {
    const modelKey = `${providerName}Model`;
    if (config[modelKey]) {
      providers[providerName] = config[modelKey];
    } else {
      throw new Error(`Missing model configuration for provider: ${providerName}`);
    }
  });

  if (!providers[provider]) {
    throw new Error(`Missing model for provider: ${provider}`);
  }

  return providers[provider];
}

/**
 * Log the active configuration
 *
 * @param config Configuration object
 * @param logger Logger instance
 */
function logConfiguration(config: any, logger: Logger): void {
  const configSummary = {
    llmProvider: config.llmProvider,
    llmModel: getLlmModelName(config),
    gitPlatform: config.gitPlatform,
    mrMode: config.mrMode,
  };

  logger.debug(`Using configuration: ${JSON.stringify(configSummary)}`);
}

/**
 * Run the code review
 *
 * @param config Configuration object
 * @returns Promise resolving when review is complete
 */
async function runReview(config: any): Promise<void> {
  const reviewer = new MRReviewer(config);
  await reviewer.review();
}

/**
 * Set up global error handlers
 *
 * @param logger Logger instance
 */
function setupGlobalErrorHandlers(logger: Logger): void {
  process.on('uncaughtException', error => {
    logger.error(`Uncaught Exception: ${error.message}`);
    logger.debug(error.stack || '');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
    process.exit(1);
  });
}

/**
 * Find the command matching the given argument
 *
 * @param program Commander program
 * @param arg Command name to find
 * @returns Matching command or undefined
 */
function findCommand(program: Command, arg: string): Command | undefined {
  return program.commands.find(cmd => cmd && cmd.name() === arg);
}

/**
 * Parse command line arguments
 *
 * @param program Commander program
 * @returns Object with parsed program and selected command
 */
function parseCommandLine(program: Command): { program: Command; command: Command | undefined } {
  program.parse(process.argv);

  if (program.args.length === 0) {
    return { program, command: undefined };
  }

  const command = findCommand(program, program.args[0] ?? '');
  return { program, command };
}

/**
 * Create and validate configuration
 *
 * @param command Selected command
 * @returns Promise resolving to validated config
 */
async function createConfiguration(command: Command): Promise<any> {
  const configOptions = buildConfigOptions(command);

  const configManager = new Config({
    ...configOptions,
    gitPlatform: configOptions['gitPlatform'] || undefined,
  });

  const config = await configManager.load();
  configManager.validate();

  return config;
}

/**
 * Main workflow for processing a command
 *
 * @param command Command to process
 * @param logger Logger instance
 */
async function processCommand(command: Command, logger: Logger): Promise<void> {
  const options = command.opts();
  const updatedLogger = configureLogger(options, logger);

  const config = await createConfiguration(command);
  logConfiguration(config, updatedLogger);

  await runReview(config);
}

/**
 * Main entry point for the application
 */
async function main(): Promise<void> {
  const logger = new Logger();
  setupGlobalErrorHandlers(logger);

  try {
    const program = initializeProgram();
    const { program: parsedProgram, command } = parseCommandLine(program);

    if (!command) {
      parsedProgram.help();
      process.exit(1);
      return;
    }

    await processCommand(command, logger);
  } catch (error) {
    logger.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
}

// Run the application as an immediately-invoked async function
(async () => {
  await main();
})().catch(error => {
  console.error(`Fatal error: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
