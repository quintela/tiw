#!/usr/bin/env python
"""
Tiw - LLM-powered code review tool

A CLI tool that uses Large Language Models (LLMs) to review code changes
in merge/pull requests and provide feedback.
"""

import asyncio
import os
import sys
from typing import Optional

import click

from . import __version__
from .config.config import Config, MRMode
from .core.mr_reviewer import MRReviewer
from .utils.logging import Logger


logger = Logger()

# Define valid LLM providers
VALID_PROVIDERS = ["anthropic", "openai"] # add "deepseek", "copilot" when implemented


def add_common_options(func):
    """Add common options to CLI commands."""
    func = click.option(
        "-p", "--provider",
        type=click.Choice(VALID_PROVIDERS, case_sensitive=False),
        default="anthropic",
        help="LLM provider to use",
    )(func)
    
    func = click.option(
        "-m", "--model",
        help="LLM model to use (default depends on provider)",
    )(func)
    
    func = click.option(
        "--platform",
        type=click.Choice(["gitlab", "github"], case_sensitive=False),
        help="Git platform (gitlab or github), auto-detected if not specified",
    )(func)
    
    func = click.option(
        "--templates",
        type=click.Path(exists=True, file_okay=False, dir_okay=True),
        help="Directory containing all templates and prompts",
    )(func)
    
    func = click.option(
        "--reviews-dir",
        type=click.Path(file_okay=False, dir_okay=True),
        help="Directory to save review files",
    )(func)
    
    func = click.option(
        "--verbose",
        is_flag=True,
        help="Enable verbose logging with diff preview",
    )(func)
    
    func = click.option(
        "--debug",
        is_flag=True,
        help="Enable debug mode with detailed logging",
    )(func)
    
    return func


@click.group(invoke_without_command=True)
@click.version_option(version=__version__)
@click.pass_context
def cli(ctx):
    """
    Tiw - LLM-powered code review tool.
    
    Review code changes in merge/pull requests using LLMs.
    """
    # If no subcommand is provided, show help
    if ctx.invoked_subcommand is None:
        click.echo(ctx.get_help())
        sys.exit(0)


@cli.command()
@add_common_options
@click.pass_context
async def local(ctx, provider, model, platform, templates, reviews_dir, verbose, debug):
    """Review local git changes."""
    # Configure options
    options = {
        "llm_provider": provider,
        "model": model,
        "git_platform": platform,
        "templates": templates,
        "reviews_dir": reviews_dir,
        "verbose": verbose or debug,
        "debug": debug,
        "mr_mode": MRMode.LOCAL,
        "show_diff": verbose or debug,
    }
    
    # Run the review
    await run_review(options)


@cli.command()
@add_common_options
@click.pass_context
async def ci(ctx, provider, model, platform, templates, reviews_dir, verbose, debug):
    """Review changes in CI environment."""
    # Configure options
    options = {
        "llm_provider": provider,
        "model": model,
        "git_platform": platform,
        "templates": templates,
        "reviews_dir": reviews_dir,
        "verbose": verbose or debug,
        "debug": debug,
        "mr_mode": MRMode.CI,
        "show_diff": verbose or debug,
    }
    
    # Run the review
    await run_review(options)


@cli.command()
@click.argument("url", type=str, required=True)
@add_common_options
@click.pass_context
async def url(ctx, url, provider, model, platform, templates, reviews_dir, verbose, debug):
    """Review a specific merge/pull request by URL."""
    # Configure options
    options = {
        "llm_provider": provider,
        "model": model,
        "git_platform": platform,
        "templates": templates,
        "reviews_dir": reviews_dir,
        "verbose": verbose or debug,
        "debug": debug,
        "mr_mode": MRMode.URL,
        "git_mr_url": url,
        "show_diff": verbose or debug,
    }
    
    # Run the review
    await run_review(options)


async def run_review(options):
    """Run the review with the provided options."""
    try:
        # Configure logger
        if options.get("debug"):
            logger.set_level("DEBUG")
        elif options.get("verbose"):
            logger.set_level("INFO")
        
        # Load and validate configuration
        config_manager = Config.get_instance(options)
        config = await config_manager.load()
        config_manager.validate()
        
        # Log configuration
        if options.get("verbose"):
            logger.info(f"Using {config.llm_provider} with model {getattr(config, f'{config.llm_provider}_model')}")
            logger.info(f"Git platform: {config.git_platform}")
            logger.info(f"Mode: {config.mr_mode}")
        
        # Create and run the reviewer
        reviewer = MRReviewer(config)
        result = await reviewer.review()
        
        if result:
            logger.info(f"Review saved to: {result}")
        
        return result
    
    except Exception as e:
        logger.error(f"Error running review: {str(e)}")
        if options.get("debug"):
            import traceback
            logger.error(traceback.format_exc())
        sys.exit(1)


def main():
    """Main entry point for the CLI."""
    try:
        # Run the CLI in an asyncio event loop
        asyncio.run(cli())
    except KeyboardInterrupt:
        logger.info("Operation cancelled by user")
        sys.exit(130)
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()