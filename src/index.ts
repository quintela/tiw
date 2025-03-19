#!/usr/bin/env ts-node

/**
 * Tiw - LLM-powered code review tool
 *
 * @license Apache-2.0
 * @author Tiago <913367+quintela@users.noreply.github.com>
 * @copyright 2025 Tiago
 */
import { Command } from 'commander';

import { Config, type GitPlatform, type LLMProvider, type MRMode } from './config/config';
import { MRReviewer } from './core/MRReviewer';
import { Logger } from './utils/logging';

/**
 * Main entry point for the application
 */
async function main(): Promise<void> {
  const logger = new Logger();

  try {
    const program = new Command();

    program
      .name('tiw')
      .description('Check merge/pull requests using LLM analysis')
      .version('2.0.0')
      .option(
        '-p, --provider <provider>',
        'LLM provider (anthropic, openai, deepseek, or copilot)',
        'anthropic'
      )
      .option('-m, --model <model>', 'LLM model to use (default depends on provider)')
      .option(
        '--platform <platform>',
        'Git platform (gitlab or github), auto-detected if not specified'
      )
      .option('--prompt-dir <directory>', 'Directory containing prompt templates')
      .option('--formatter <templatePath>', 'Path to formatter template')
      .option('--mode <mode>', 'MR mode (ci, local, or url)', 'local')
      .option('--mr-url <url>', 'MR/PR URL (required if mode is url)')
      .option('--gitlab-url <url>', 'GitLab instance URL (defaults to https://gitlab.com)')
      .option('--show-diff', 'Show the diff before sending to LLM for review')
      .option('--reviews-dir <path>', 'Directory to save review files')
      .option('--verbose', 'Enable verbose logging')
      .option('--debug', 'Enable debug logging')
      .parse(process.argv);

    const options = program.opts();

    // Set log level
    if (options['debug']) {
      logger.setLevel('debug');
    } else if (options['verbose']) {
      logger.setLevel('info');
    }

    // Set GitLab URL if provided via CLI
    if (options['gitlabUrl']) {
      process.env['GITLAB_URL'] = options['gitlabUrl'];
    }

    // Prepare options object for configuration
    const configOptions = {
      llmProvider: options['provider'] as LLMProvider,
      model: options['model'],
      gitPlatform: options['platform'] as GitPlatform | undefined,
      promptDir: options['promptDir'],
      formatterTemplate: options['formatter'],
      mrMode: options['mode'] as MRMode,
      gitMrUrl: options['mrUrl'],
      showDiff: !!options['showDiff'],
      reviewsDir: options['reviewsDir'],
    };

    // Create and load configuration
    const configManager = new Config({
      ...configOptions,
      gitPlatform: configOptions.gitPlatform || undefined,
    });
    const config = await configManager.load();

    // Validate configuration
    configManager.validate();

    // Log configuration
    logger.debug(
      `Using configuration: ${JSON.stringify({
        llmProvider: config.llmProvider,
        llmModel:
          config.llmProvider === 'anthropic'
            ? config.anthropicModel
            : config.llmProvider === 'openai'
              ? config.openaiModel
              : config.llmProvider === 'deepseek'
                ? config.deepseekModel
                : config.copilotModel,
        gitPlatform: config.gitPlatform,
        mrMode: config.mrMode,
      })}`
    );

    // Create and run reviewer
    const reviewer = new MRReviewer(config);
    await reviewer.review();
  } catch (error) {
    logger.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
}

// Run the application
main();
