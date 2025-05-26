# Tiw (Python Version)

A Python CLI tool that uses Large Language Models (LLMs) to review code changes in merge/pull requests and provide feedback. Supports multiple LLM providers (Anthropic, OpenAI) and Git platforms (GitLab, GitHub).

Tiw (reads "tiu") is a simple command-line utility that helps you analyze code changes with the help of advanced language models.

## Features

- Analyze code diffs using various LLM providers:
  - Anthropic Claude models
  - OpenAI GPT models
- Support for multiple Git platforms:
  - GitLab merge requests
  - GitHub pull requests
- Support for multiple operating modes:
  - Local mode: Review changes in your local git repo
  - CI mode: Review merge/pull requests in CI pipelines
  - URL mode: Review by providing a GitLab MR or GitHub PR URL
- Post review comments directly on merge/pull requests
- Automatic saving of reviews in structured JSON format
- Well-formatted Markdown comments with proper section structure
- Customizable prompt templates
- Configurable review saving directory
- Options to ignore lock files in diffs
- Modular and extensible architecture with adapter pattern

## Installation

### Installation from Source

```sh
pip install -e .
```

## Configuration

Set the following environment variables or create a `.env` file:

```sh
# LLM Configuration
LLM_PROVIDER=anthropic # or openai
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key

# LLM Model Selection
ANTHROPIC_MODEL=claude-3-7-sonnet-20250219
OPENAI_MODEL=gpt-4

# Token Limits Configuration
MAX_PROMPT_TOKENS=100000
ANTHROPIC_MAX_TOKENS=190000
OPENAI_MAX_TOKENS=128000

# Git Platform Configuration
GIT_PLATFORM=gitlab # or github
GITLAB_URL=https://gitlab.com
GITLAB_TOKEN=your_gitlab_token
GITHUB_TOKEN=your_github_token

# Other Options
VERBOSE=true # Enable verbose logging
IGNORE_LOCK_FILES=true # Skip lock files in diffs (default: true)
```

## Usage

### Running the Tool

```sh
# Local mode - review local git changes
tiw local [options]

# CI mode - review changes in CI environment
tiw ci [options]

# URL mode - review a specific merge/pull request by URL
tiw url <url> [options]
```

If no command is provided, help information will be displayed.

### Common Options

The following options are available for all commands:

```sh
# Select LLM provider
-p, --provider <provider>  LLM provider (anthropic or openai) (default: "anthropic")

# Specify custom model
-m, --model <model>        LLM model to use (default depends on provider)

# Specify Git platform
--platform <platform>      Git platform (gitlab or github), auto-detected if not specified

# Set template directory
--templates <directory>    Directory containing all templates and prompts

# Set review storage directory
--reviews-dir <path>       Directory to save review files

# Logging options
--verbose                  Enable verbose logging with diff preview
--debug                    Enable debug mode with detailed logging

# Help and version
-h, --help                 Display help
--version                  Display version
```

### Viewing Available Commands and Options

```sh
tiw --help
```

Or for help with a specific command:

```sh
tiw local --help
tiw ci --help
tiw url --help
```

## LLM Provider Configuration

### Anthropic Claude

```sh
# Use Anthropic Claude
tiw local --provider anthropic --model claude-3-7-sonnet-20250219
# OR using environment variables
export LLM_PROVIDER=anthropic
export ANTHROPIC_API_KEY=your_api_key
export ANTHROPIC_MODEL=claude-3-7-sonnet-20250219
tiw local
```

### OpenAI

```sh
# Use OpenAI
tiw local --provider openai --model gpt-4
# OR using environment variables
export LLM_PROVIDER=openai
export OPENAI_API_KEY=your_api_key
export OPENAI_MODEL=gpt-4
tiw local
```

## Review Storage

All generated reviews are automatically saved to the `reviews` directory in JSON format. Each file contains:

- Metadata about the review:
  - Timestamp when the review was performed
  - LLM provider and model used
  - Git platform (GitLab, GitHub)
  - MR mode (local, CI, URL)
  - Command line arguments used to run the tool
- Complete JSON response from the LLM

## Project Structure

```
tiw/
├── __init__.py         # Package initialization
├── cli.py              # Command-line interface
├── adapters/           # Adapter implementations
│   ├── git/            # Git platform adapters
│   │   ├── __init__.py
│   │   ├── git_adapter.py
│   │   ├── github_adapter.py
│   │   └── gitlab_adapter.py
│   └── llm/            # LLM provider adapters
│       ├── __init__.py
│       ├── llm_adapter.py
│       ├── anthropic_adapter.py
│       └── openai_adapter.py
├── config/             # Configuration management
│   ├── __init__.py
│   └── config.py
├── core/               # Core functionality
│   ├── __init__.py
│   ├── mr_reviewer.py
│   └── review_formatter.py
├── templates/          # Templates for prompts and formatters
│   ├── formatters/
│   │   └── markdown_format.md
│   └── prompts/
│       ├── introduction.md
│       ├── criteria.md
│       ├── priorities.md
│       ├── diff.md
│       └── output_format.md
└── utils/              # Utility functions
    ├── __init__.py
    ├── file_utils.py
    ├── git_detector.py
    ├── logging.py
    └── validation.py
```

## Extending

### Adding a New LLM Provider

1. Create a new adapter in `tiw/adapters/llm/`
2. Extend the `LLMAdapter` abstract class
3. Implement required methods:
   - `__init__`: Setup API client with config
   - `init_client`: Initialize the client
   - `send_request`: Handle code review with your LLM
4. Add the new provider to the factory in `tiw/adapters/llm/__init__.py`
5. Add relevant configuration options in `tiw/config/config.py`
6. Update the `VALID_PROVIDERS` array in `tiw/cli.py`

### Adding a New Git Platform

1. Create a new adapter in `tiw/adapters/git/`
2. Extend the `GitAdapter` abstract class
3. Implement required methods:
   - `parse_request_url`: Extract identifiers from platform-specific URLs
   - `get_request_diff`: Get diff content from the platform's API
   - `comment_on_request`: Post comments on merge/pull requests
4. Add the new platform to the factory in `tiw/adapters/git/__init__.py`
5. Update auto-detection in `tiw/utils/git_detector.py`

## License

This project is licensed under the Apache License, Version 2.0.

## Author

© 2025 Tiago <913367+quintela@users.noreply.github.com>